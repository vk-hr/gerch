// Applies pending migrations to DATABASE_URL: `bun run migrate`.
import { bunSqlDb } from "@/server/db.ts"
import { databaseUrl } from "@/server/env.ts"
import { migrate } from "@/server/migrations.ts"

const url = databaseUrl()
if (url === undefined) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}
const applied = await migrate(bunSqlDb(url))
console.log(
  applied.length === 0
    ? "no pending migrations"
    : `applied: ${applied.join(", ")}`
)
