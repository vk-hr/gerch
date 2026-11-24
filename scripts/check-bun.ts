// Fails unless the running Bun is the pinned canary. `bun --version` prints
// 1.4.6 for this canary and for stable 1.4.6, so compare `bun --revision`.
const BUN_NPM_VERSION = "1.4.5-canary.20261124.1"
const BUN_REVISION = "1.4.6-canary.1+bd92f9bef"

function bunOutput(flag: string): string {
  return Bun.spawnSync([process.execPath, flag]).stdout.toString().trim()
}

if (import.meta.main) {
  const revision = bunOutput("--revision")
  console.log(`bun --version:  ${bunOutput("--version")}`)
  console.log(`bun --revision: ${revision}`)
  if (revision !== BUN_REVISION) {
    console.error(
      `expected bun --revision ${BUN_REVISION} (npm bun@${BUN_NPM_VERSION})`
    )
    process.exit(1)
  }
}

export { BUN_NPM_VERSION, BUN_REVISION }
