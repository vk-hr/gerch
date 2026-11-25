// Deletes field vitals older than 30 days from DATABASE_URL:
// `DATABASE_URL=… bun scripts/prune-vitals.ts`. Runs with the nix ingest in
// .github/workflows/nix-ingest.yml (D33).
import { connect } from "@/server/db/index.ts"
import { databaseUrl } from "@/server/env.ts"
import { pruneVitals } from "@/server/vitals.ts"

const url = databaseUrl()
if (url === undefined) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}
console.log(`vitals pruned: ${await pruneVitals(connect(url))} samples`)
process.exit(0)
