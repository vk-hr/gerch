// Proves the e2e shards together run every flow exactly once
// (docs/directives/ci.md, "prove the shards together ran every file"). Each
// shard job runs it: `bun scripts/check-e2e-shards.ts 4`.
const FIRST_ARG = 2
const TEST_LINE = /^ {2}(?<test>\S+\.e2e\.ts:\d+:\d+ › .+)$/u

function listedTests(output: string): string[] {
  return output.split("\n").flatMap((line) => {
    const test = TEST_LINE.exec(line)?.groups?.test
    return test === undefined ? [] : [test]
  })
}

function shardProblems(all: string[], shards: string[][]): string[] {
  const runs = new Map(all.map((test) => [test, 0]))
  for (const test of shards.flat()) {
    runs.set(test, (runs.get(test) ?? 0) + 1)
  }
  const missing = all
    .filter((test) => runs.get(test) === 0)
    .map((test) => `no shard runs ${test}`)
  const repeated = [...runs]
    .filter(([, count]) => count > 1)
    .map(([test, count]) => `${count} shards run ${test}`)
  return [...missing, ...repeated]
}

async function list(shard?: string): Promise<string[]> {
  const args = ["x", "playwright", "test", "--list"]
  const proc = Bun.spawn(
    [process.execPath, ...args, ...(shard === undefined ? [] : [shard])],
    { stderr: "inherit", stdout: "pipe" }
  )
  const output = await new Response(proc.stdout).text()
  if ((await proc.exited) !== 0) {
    throw new Error(`playwright --list ${shard ?? ""} failed`)
  }
  return listedTests(output)
}

if (import.meta.main) {
  const total = Number(Bun.argv[FIRST_ARG])
  if (!Number.isInteger(total) || total < 1) {
    throw new Error("usage: check-e2e-shards.ts <shard count>")
  }
  const shards = Array.from({ length: total }, async (_unused, index) =>
    list(`--shard=${index + 1}/${total}`)
  )
  const [all, lists] = await Promise.all([list(), Promise.all(shards)])
  const problems = shardProblems(all, lists)
  if (problems.length > 0) {
    console.error(problems.join("\n"))
    process.exit(1)
  }
  console.log(`${total} shards run all ${all.length} flows once each`)
}

export { listedTests, shardProblems }
