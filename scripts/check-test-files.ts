// Proves the test run (all shards together) ran every test file.
const FIRST_ARG = 2
const FILE_ATTRIBUTE = / file="(?<file>[^"]+)"/gu

function missingTestFiles(
  reports: readonly string[],
  testFiles: readonly string[]
): string[] {
  const ran = new Set(
    reports.flatMap((xml) =>
      [...xml.matchAll(FILE_ATTRIBUTE)].map((match) => match.groups?.file)
    )
  )
  return testFiles.filter((file) => !ran.has(file))
}

if (import.meta.main) {
  const reports = await Promise.all(
    Bun.argv.slice(FIRST_ARG).map(async (path) => Bun.file(path).text())
  )
  const testFiles = await Array.fromAsync(
    new Bun.Glob("**/*.test.{ts,tsx}").scan({ cwd: "." })
  )
  const missing = missingTestFiles(
    reports,
    testFiles.filter((file) => !file.startsWith("node_modules/"))
  )
  console.log(
    `test files: ${testFiles.length}, missing from reports: ${missing.length}`
  )
  if (missing.length > 0) {
    console.error(missing.join("\n"))
    process.exit(1)
  }
}

export { missingTestFiles }
