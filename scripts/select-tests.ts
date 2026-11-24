// Picks the tests a diff can reach. Shared inputs rerun everything, because
// `bun test --changed` only follows imports. CI also runs the full suite on
// every PR, so selection only narrows feedback (docs/directives/ci.md).
const RERUN_ALL_FILES = new Set([
  "package.json",
  "bun.lock",
  "bunfig.toml",
  "tsconfig.json",
  "vite.config.ts",
  "flake.nix",
  "flake.lock",
  "test/vitest.d.ts",
  "scripts/select-tests.ts",
])
const RERUN_ALL_DIRS = ["test/fixtures/", ".github/"]

type TestPlan = { mode: "all"; reason: string } | { mode: "changed" | "none" }

function testPlan(changed: readonly string[]): TestPlan {
  const reason = changed.find(
    (file) =>
      RERUN_ALL_FILES.has(file) ||
      RERUN_ALL_DIRS.some((dir) => file.startsWith(dir))
  )
  if (reason !== undefined) {
    return { mode: "all", reason }
  }
  if (changed.length === 0) {
    return { mode: "none" }
  }
  return { mode: "changed" }
}

function git(...args: string[]): string {
  const proc = Bun.spawnSync(["git", ...args])
  if (proc.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")}: ${proc.stderr.toString()}`)
  }
  return proc.stdout.toString().trim()
}

if (import.meta.main) {
  const base = git(
    "merge-base",
    process.env.GERCH_TEST_BASE ?? "origin/main",
    "HEAD"
  )
  const changed = git("diff", "--name-only", base, "HEAD")
    .split("\n")
    .filter(Boolean)
  const plan = testPlan(changed)
  console.log(`test selection against ${base}: ${JSON.stringify(plan)}`)
  if (plan.mode !== "none") {
    const args = ["test", "--isolate=modules"]
    if (plan.mode === "changed") {
      args.push(`--changed=${base}`)
    }
    const proc = Bun.spawnSync([process.execPath, ...args], {
      stdio: ["inherit", "inherit", "inherit"],
    })
    process.exit(proc.exitCode)
  }
}

export { testPlan }
