// Runs every check in parallel, reports every failure and how long each
// check took. The pre-push hook runs all of them; each CI job runs the ones
// it names: `bun run verify lint format`.
const FIRST_ARG = 2
const bun = process.execPath
const JUNIT = "test-results/junit.xml"
const NAME_WIDTH = 10
const MS_WIDTH = 6

interface Check {
  name: string
  cmd: string[]
}

interface Result extends Check {
  exitCode: number
  ms: number
  output: string
}

const checks: Check[] = [
  { cmd: [bun, "scripts/check-bun.ts"], name: "pin" },
  { cmd: [bun, "fmt", "--check"], name: "format" },
  { cmd: [bun, "lint"], name: "lint" },
  { cmd: [bun, "check"], name: "typecheck" },
  {
    cmd: [
      "sh",
      "-c",
      `"${bun}" test --isolate=modules --reporter=junit --reporter-outfile=${JUNIT} && "${bun}" scripts/check-test-files.ts ${JUNIT}`,
    ],
    name: "test",
  },
  {
    cmd: [
      "sh",
      "-c",
      `"${bun}" run build && git diff --exit-code -- src/routeTree.gen.ts && "${bun}" scripts/check-budgets.ts`,
    ],
    name: "build",
  },
]

async function run(check: Check): Promise<Result> {
  const started = performance.now()
  const proc = Bun.spawn(check.cmd, { stderr: "pipe", stdout: "pipe" })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return Object.assign(check, {
    exitCode,
    ms: Math.round(performance.now() - started),
    output: stdout + stderr,
  })
}

function report(results: Result[]): string[] {
  return results.flatMap((result) => {
    const failed = result.exitCode !== 0
    const ms = String(result.ms).padStart(MS_WIDTH)
    console.log(
      `${failed ? "FAIL" : "ok  "} ${result.name.padEnd(NAME_WIDTH)} ${ms} ms`
    )
    return failed
      ? [`${result.name}: exit ${result.exitCode}\n${result.output}`]
      : []
  })
}

const names = Bun.argv.slice(FIRST_ARG)
const unknown = names.filter(
  (name) => !checks.some((check) => check.name === name)
)
if (unknown.length > 0) {
  console.error(`unknown checks: ${unknown.join(", ")}`)
  process.exit(1)
}
const selected = checks.filter(
  (check) => names.length === 0 || names.includes(check.name)
)
const failures = report(
  await Promise.all(selected.map(async (check) => run(check)))
)
if (failures.length > 0) {
  console.error(`\n${failures.join("\n\n")}`)
  process.exit(1)
}
