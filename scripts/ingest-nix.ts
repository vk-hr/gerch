// Refreshes the nix index in DATABASE_URL from the nixos-unstable channel
// dump, when its ETag has changed: `DATABASE_URL=… bun scripts/ingest-nix.ts`.
// Runs every 6 h in .github/workflows/nix-ingest.yml (D30).
import { connect } from "@/server/db/index.ts"
import { databaseUrl } from "@/server/env.ts"
import { runNixIngest } from "@/server/nix/ingest.ts"

const url = databaseUrl()
if (url === undefined) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}
const MS_PER_S = 1000
const started = performance.now()
const result = await runNixIngest(connect(url), fetch)
const seconds = ((performance.now() - started) / MS_PER_S).toFixed(1)
console.log(
  result.status === "replaced"
    ? `nix index replaced: ${result.packages} packages in ${seconds} s`
    : `nix index unchanged (same ETag), checked in ${seconds} s`
)
process.exit(0)
