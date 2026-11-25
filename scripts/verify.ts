// Runs every check, reports every failure, and fails any check that exceeds
// its time budget (docs/directives/ci.md). The pre-push hook runs all of
// them; each CI job runs the ones it names: `bun run verify lint format`.
const FIRST_ARG = 2
const bun = process.execPath
const JUNIT = "test-results/junit.xml"
const NAME_WIDTH = 10
const MS_WIDTH = 6

interface Check {
  name: string
  cmd: string[]
  budgetMs: number
}

interface Result extends Check {
  exitCode: number
  ms: number
  output: string
}

const checks: Check[] = [
  { budgetMs: 1000, cmd: [bun, "scripts/check-bun.ts"], name: "pin" },
  { budgetMs: 1000, cmd: [bun, "fmt", "--check"], name: "format" },
  { budgetMs: 1000, cmd: [bun, "lint"], name: "lint" },
  { budgetMs: 5000, cmd: [bun, "check"], name: "typecheck" },
  {
    budgetMs: 30_000,
    cmd: [
      "sh",
      "-c",
      `"${bun}" test --isolate=modules --reporter=junit --reporter-outfile=${JUNIT} && "${bun}" scripts/check-test-files.ts ${JUNIT}`,
    ],
    name: "test",
  },
  {
    budgetMs: 30_000,
    cmd: [
      "sh",
      "-c",
      `"${bun}" run build && git diff --exit-code -- src/routeTree.gen.ts`,
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

function failuresOf(result: Result): string[] {
  const failures: string[] = []
  if (result.exitCode !== 0) {
    failures.push(`${result.name}: exit ${result.exitCode}\n${result.output}`)
  }
  if (result.ms > result.budgetMs) {
    failures.push(
      `${result.name}: ${result.ms} ms is over the ${result.budgetMs} ms budget`
    )
  }
  return failures
}

function report(results: Result[]): string[] {
  return results.flatMap((result) => {
    const failures = failuresOf(result)
    const ms = String(result.ms).padStart(MS_WIDTH)
    console.log(
      `${failures.length > 0 ? "FAIL" : "ok  "} ${result.name.padEnd(NAME_WIDTH)} ${ms} ms (budget ${result.budgetMs} ms)`
    )
    return failures
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
// Type-aware lint and `bun check` both type-check the project, so lint runs
// on its own first and its 1 s budget measures lint, not the two competing
// for cores (docs/decisions.md D9). The rest run in parallel.
const lint = selected.filter((check) => check.name === "lint")
const rest = selected.filter((check) => check.name !== "lint")
const lintResults = await Promise.all(lint.map(async (check) => run(check)))
const restResults = await Promise.all(rest.map(async (check) => run(check)))
const failures = report([...lintResults, ...restResults])
if (failures.length > 0) {
  console.error(`\n${failures.join("\n\n")}`)
  process.exit(1)
}
