// Checks the PR title and every non-merge commit in base..head with
// `hk util check-conventional-commit`, and reports every failure.
const FIRST_ARG = 2
const SHORT_SHA = 7
const [base, head] = Bun.argv.slice(FIRST_ARG)
if (base === undefined || head === undefined) {
  console.error("usage: bun scripts/check-commits.ts <base-sha> <head-sha>")
  process.exit(1)
}

function git(...args: string[]): string {
  return Bun.spawnSync(["git", ...args])
    .stdout.toString()
    .trim()
}

const messages = git("rev-list", "--no-merges", `${base}..${head}`)
  .split("\n")
  .filter(Boolean)
  .map((sha) => ({
    label: sha.slice(0, SHORT_SHA),
    text: git("log", "-1", "--format=%B", sha),
  }))
const title = process.env.PR_TITLE
if (title !== undefined && title !== "") {
  messages.unshift({ label: "PR title", text: title })
}

const dir = process.env.RUNNER_TEMP ?? "/tmp"
const files = [...messages.keys()].map((index) => `${dir}/commit-msg-${index}`)
await Promise.all(
  messages.map(async (message, index) =>
    Bun.write(files[index] ?? "", `${message.text}\n`)
  )
)
const failures: string[] = []
for (const [index, message] of messages.entries()) {
  const file = files[index] ?? ""
  const proc = Bun.spawnSync(["hk", "util", "check-conventional-commit", file])
  const status = proc.exitCode === 0 ? "ok  " : "FAIL"
  console.log(`${status} ${message.label}: ${message.text.split("\n")[0]}`)
  if (proc.exitCode !== 0) {
    failures.push(`${message.label}: ${proc.stderr.toString().trim()}`)
  }
}
if (failures.length > 0) {
  console.error(`\n${failures.join("\n")}`)
  process.exit(1)
}
