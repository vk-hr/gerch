// The CI directive's audit: the last 150 completed CI runs, each job split
// into waiting, setup and running at p50 and p95, plus how long a PR waits
// for its result (D38).
//   GITHUB_TOKEN=$(gh auth token) bun scripts/ci-audit.ts [runs]
import { z } from "zod"

const REPO = "vk-hr/gerch"
const DEFAULT_RUNS = 150
const PAGE = 100
const RUNS_ARG = 2
const P50 = 50
const P95 = 95
const PERCENT = 100
const MS_PER_S = 1000
const SETUP_STEP = "Run ./.github/actions/setup"
const SHARD = /^e2e(?:-\d+)?$/u

interface Step {
  name: string
  started_at: string | null
  completed_at: string | null
}

interface Job {
  name: string
  created_at: string
  started_at: string | null
  completed_at: string | null
  steps: Step[]
}

interface Phases {
  name: string
  waitingMs: number
  setupMs: number
  runningMs: number
}

const ms = (iso: string) => Date.parse(iso)

// Waiting: queued until a runner picks the job up. Setup: from then until
// the setup action finishes (runner set-up, checkout, toolchain). Running:
// the rest. A job that never started, or never ran setup, is skipped.
function jobPhases(job: Job): Phases | null {
  const setup = job.steps.find((step) => step.name === SETUP_STEP)
  if (
    job.started_at === null ||
    job.completed_at === null ||
    setup?.completed_at === null ||
    setup?.completed_at === undefined
  ) {
    return null
  }
  const setupDone = ms(setup.completed_at)
  return {
    name: job.name,
    runningMs: ms(job.completed_at) - setupDone,
    setupMs: setupDone - ms(job.started_at),
    waitingMs: ms(job.started_at) - ms(job.created_at),
  }
}

// The four e2e shards count as one family.
function shardFamily(name: string): string {
  return SHARD.test(name) ? "e2e (4 shards)" : name
}

// Nearest-rank percentile.
function percentile(values: readonly number[], at: number): number {
  const sorted = values.toSorted((left, right) => left - right)
  const rank = Math.max(Math.ceil((at / PERCENT) * sorted.length), 1)
  return sorted[rank - 1] ?? 0
}

// From the run's creation until its last job finished: what a PR waits for.
function runResultMs(createdAt: string, jobs: readonly Job[]): number {
  const finished = jobs.flatMap((job) =>
    job.completed_at === null ? [] : [ms(job.completed_at)]
  )
  return Math.max(...finished) - ms(createdAt)
}

function seconds(values: readonly number[]): string {
  const format = (at: number) => (percentile(values, at) / MS_PER_S).toFixed(1)
  return `${format(P50)} / ${format(P95)}`
}

// Seconds at p50 / p95 for each phase, per job family.
function auditRows(phases: readonly Phases[]) {
  const families = new Map<string, Phases[]>()
  for (const phase of phases) {
    const family = shardFamily(phase.name)
    families.set(family, [...(families.get(family) ?? []), phase])
  }
  return [...families]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([name, rows]) => ({
      jobs: rows.length,
      name,
      running: seconds(rows.map((row) => row.runningMs)),
      setup: seconds(rows.map((row) => row.setupMs)),
      waiting: seconds(rows.map((row) => row.waitingMs)),
    }))
}

const stepSchema = z.object({
  completed_at: z.string().nullable(),
  name: z.string(),
  started_at: z.string().nullable(),
})
const jobSchema = z.object({
  completed_at: z.string().nullable(),
  created_at: z.string(),
  name: z.string(),
  started_at: z.string().nullable(),
  steps: z.array(stepSchema).default([]),
})
const runSchema = z.object({
  created_at: z.string(),
  event: z.string(),
  id: z.number(),
})

async function github(path: string): Promise<unknown> {
  const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${process.env.GITHUB_TOKEN ?? ""}`,
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub ${response.status} for ${path}`)
  }
  return response.json()
}

async function completedRuns(count: number) {
  const pages = Math.ceil(count / PAGE)
  const bodies = await Promise.all(
    Array.from({ length: pages }, async (_unused, page) =>
      github(
        `actions/workflows/ci.yml/runs?status=completed&per_page=${PAGE}&page=${page + 1}`
      )
    )
  )
  return bodies
    .flatMap(
      (body) =>
        z.object({ workflow_runs: z.array(runSchema) }).parse(body)
          .workflow_runs
    )
    .slice(0, count)
}

async function runJobs(id: number): Promise<Job[]> {
  const body = await github(`actions/runs/${id}/jobs?per_page=${PAGE}`)
  return z.object({ jobs: z.array(jobSchema) }).parse(body).jobs
}

async function main(): Promise<void> {
  const runs = await completedRuns(Number(Bun.argv[RUNS_ARG] ?? DEFAULT_RUNS))
  const withJobs = await Promise.all(
    runs.map(async (run) => ({ ...run, jobs: await runJobs(run.id) }))
  )
  const phases = withJobs.flatMap((run) =>
    run.jobs.flatMap((job) => jobPhases(job) ?? [])
  )
  console.log(`${runs.length} completed CI runs; seconds at p50 / p95`)
  console.table(auditRows(phases))
  const prResults = withJobs
    .filter((run) => run.event === "pull_request" && run.jobs.length > 0)
    .map((run) => runResultMs(run.created_at, run.jobs))
  console.log(`PR result, ${prResults.length} runs: ${seconds(prResults)} s`)
}

if (import.meta.main) {
  await main()
}

export { auditRows, jobPhases, percentile, runResultMs, shardFamily }
export type { Job, Phases }
