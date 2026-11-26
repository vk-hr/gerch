// Balances the e2e flows across CI shards by the time each flow took on
// main (docs/directives/ci.md, "Balance shards from file times that main
// records"; D37). Every shard computes the same plan from `playwright test
// --list` and the recorded timings, so they need no coordination.
//   bun scripts/e2e-shards.ts run <shard> <total>    run this shard's flows
//   bun scripts/e2e-shards.ts check <shard> <total>  prove the plan covers
//     every flow once and this shard ran exactly its own
//   bun scripts/e2e-shards.ts record <report.json…>  merge shard reports into
//     timings (stdout); fails on an e2e file over 20 s
import { z } from "zod"

const TIMINGS_FILE = ".e2e-timings.json"
const REPORT_FILE = "e2e-report.json"
const DEFAULT_MS = 1000
const FILE_BUDGET_MS = 20_000
const FIRST_ARG = 2
const JSON_INDENT = 2
const HALF = 2
const TEST_LINE = /^ {2}(?<file>\S+\.e2e\.ts):(?<line>\d+):\d+ › (?<title>.+)$/u

interface Flow {
  // "<file> › <describe> › <title>", stable while lines move.
  key: string
  // "e2e/<file>:<line>", what `playwright test` accepts to run one flow.
  location: string
}

type Timings = Record<string, number>

interface ReportSpec {
  title: string
  tests: { results: { duration: number; status: string }[] }[]
}

interface ReportSuite {
  title: string
  file?: string
  specs: ReportSpec[]
  suites?: ReportSuite[]
}

interface Report {
  suites: ReportSuite[]
}

function listedFlows(output: string): Flow[] {
  return output.split("\n").flatMap((line) => {
    const { file, line: at, title } = TEST_LINE.exec(line)?.groups ?? {}
    return file === undefined || title === undefined
      ? []
      : [{ key: `${file} › ${title}`, location: `e2e/${file}:${at}` }]
  })
}

function specDurations(spec: ReportSpec, path: readonly string[]) {
  const key = [...path, spec.title].join(" › ")
  return spec.tests
    .flatMap((run) => run.results)
    .filter((result) => result.status !== "skipped")
    .map((result): [string, number] => [key, result.duration])
}

// Every flow that ran, with its duration, keyed like `listedFlows`: the file
// suite, then describe titles, then the flow.
function suiteDurations(
  suite: ReportSuite,
  path: readonly string[]
): [string, number][] {
  return [
    ...suite.specs.flatMap((spec) => specDurations(spec, path)),
    ...(suite.suites ?? []).flatMap((child) =>
      suiteDurations(child, [...path, child.title])
    ),
  ]
}

function reportedFlows(report: Report): [string, number][] {
  return report.suites.flatMap((suite) => suiteDurations(suite, [suite.title]))
}

function durationsFromReport(report: Report): Timings {
  return Object.fromEntries(reportedFlows(report))
}

function median(values: readonly number[]): number {
  const sorted = values.toSorted((left, right) => left - right)
  return sorted[Math.floor((sorted.length - 1) / HALF)] ?? DEFAULT_MS
}

function costOf(timings: Timings): (planned: Flow) => number {
  const known = Object.values(timings)
  const fallback = known.length === 0 ? DEFAULT_MS : median(known)
  return (planned) => timings[planned.key] ?? fallback
}

// Longest flow first, each onto the least loaded shard (ties go to the
// lower shard). A flow main hasn't timed yet counts the median time.
function planShards(
  flows: readonly Flow[],
  timings: Timings,
  total: number
): Flow[][] {
  const cost = costOf(timings)
  const order = flows.toSorted(
    (left, right) => cost(right) - cost(left) || (left.key < right.key ? -1 : 1)
  )
  const shards = Array.from({ length: total }, () => ({
    flows: new Array<Flow>(),
    load: 0,
  }))
  for (const planned of order) {
    const lightest = shards.reduce((best, shard) =>
      shard.load < best.load ? shard : best
    )
    lightest.flows.push(planned)
    lightest.load += cost(planned)
  }
  return shards.map((shard) => shard.flows)
}

function partitionProblems(
  all: readonly Flow[],
  shards: readonly (readonly Flow[])[]
): string[] {
  const runs = new Map(all.map((planned) => [planned.key, 0]))
  for (const planned of shards.flat()) {
    runs.set(planned.key, (runs.get(planned.key) ?? 0) + 1)
  }
  const missing = all
    .filter((planned) => runs.get(planned.key) === 0)
    .map((planned) => `no shard runs ${planned.key}`)
  const repeated = [...runs]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => `${count} shards run ${key}`)
  return [...missing, ...repeated]
}

// What a shard's report shows against what it was planned to run.
function ranProblems(planned: readonly string[], report: Report): string[] {
  const ran = new Set(reportedFlows(report).map(([key]) => key))
  const wanted = new Set(planned)
  const notRun = planned.filter((key) => !ran.has(key))
  const unplanned = [...ran].filter((key) => !wanted.has(key))
  return [
    ...notRun.map((key) => `planned but not run: ${key}`),
    ...unplanned.map((key) => `ran but not planned: ${key}`),
  ]
}

function oversizedFiles(timings: Timings): string[] {
  const perFile = new Map<string, number>()
  for (const [key, ms] of Object.entries(timings)) {
    const file = key.split(" › ")[0] ?? key
    perFile.set(file, (perFile.get(file) ?? 0) + ms)
  }
  return [...perFile]
    .filter(([, ms]) => ms > FILE_BUDGET_MS)
    .map(
      ([file, ms]) =>
        `${file} takes ${ms} ms; split it (over ${FILE_BUDGET_MS} ms)`
    )
}

const resultSchema = z.object({ duration: z.number(), status: z.string() })
const runSchema = z.object({ results: z.array(resultSchema) })
const specSchema = z.object({ tests: z.array(runSchema), title: z.string() })
const suiteSchema: z.ZodType<ReportSuite> = z.lazy(() =>
  z.object({
    file: z.string().optional(),
    specs: z.array(specSchema),
    suites: z.array(suiteSchema).optional(),
    title: z.string(),
  })
)
const reportSchema = z.object({ suites: z.array(suiteSchema) })
const timingsSchema = z.record(z.string(), z.number())

async function readJson(path: string): Promise<unknown> {
  const file = Bun.file(path)
  return (await file.exists()) ? file.json() : null
}

async function listFlows(): Promise<Flow[]> {
  const proc = Bun.spawn(
    [process.execPath, "x", "playwright", "test", "--list"],
    { stderr: "inherit", stdout: "pipe" }
  )
  const output = await new Response(proc.stdout).text()
  if ((await proc.exited) !== 0) {
    throw new Error("playwright test --list failed")
  }
  return listedFlows(output)
}

// The plan, from the flows Playwright lists and main's timings, if any.
async function plan(shard: number, total: number) {
  const recorded = timingsSchema.safeParse(await readJson(TIMINGS_FILE))
  const all = await listFlows()
  const shards = planShards(all, recorded.success ? recorded.data : {}, total)
  return { all, mine: shards[shard - 1] ?? [], shards }
}

async function runShard(shard: number, total: number): Promise<number> {
  const { all, mine } = await plan(shard, total)
  console.log(`shard ${shard}/${total}: ${mine.length} of ${all.length} flows`)
  const locations = mine.map((planned) => planned.location)
  const proc = Bun.spawn(
    [
      process.execPath,
      "x",
      "playwright",
      "test",
      "--reporter=list,json",
      ...locations,
    ],
    {
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: REPORT_FILE },
      stdio: ["inherit", "inherit", "inherit"],
    }
  )
  return proc.exited
}

async function checkShard(shard: number, total: number): Promise<string[]> {
  const { all, mine, shards } = await plan(shard, total)
  const shardReport = reportSchema.parse(await readJson(REPORT_FILE))
  const keys = mine.map((planned) => planned.key)
  return [...partitionProblems(all, shards), ...ranProblems(keys, shardReport)]
}

async function record(paths: readonly string[]): Promise<string[]> {
  const reports = await Promise.all(
    paths.map(async (path) => reportSchema.parse(await readJson(path)))
  )
  const timings: Timings = {}
  for (const shardReport of reports) {
    Object.assign(timings, durationsFromReport(shardReport))
  }
  console.log(JSON.stringify(timings, null, JSON_INDENT))
  return oversizedFiles(timings)
}

function exitWith(problems: readonly string[], success: string): number {
  for (const problem of problems) {
    console.error(problem)
  }
  if (problems.length === 0) {
    console.error(success)
  }
  return problems.length === 0 ? 0 : 1
}

async function main(args: readonly string[]): Promise<number> {
  const [command, ...rest] = args
  if (command === "record") {
    return exitWith(await record(rest), `recorded ${rest.length} reports`)
  }
  const [shard, total] = rest.map(Number)
  if (shard === undefined || total === undefined || !(shard >= 1)) {
    throw new Error("usage: e2e-shards.ts run|check <shard> <total>")
  }
  if (command === "run") {
    return runShard(shard, total)
  }
  return exitWith(
    await checkShard(shard, total),
    `the ${total} shards run every flow once; shard ${shard} ran its own`
  )
}

if (import.meta.main) {
  process.exit(await main(Bun.argv.slice(FIRST_ARG)))
}

export {
  durationsFromReport,
  listedFlows,
  oversizedFiles,
  partitionProblems,
  planShards,
  ranProblems,
}
export type { Flow, Report, ReportSuite, Timings }
