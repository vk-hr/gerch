// Applies the migrations in drizzle/ to DATABASE_URL: `bun run migrate`.
import { migrate } from "drizzle-orm/bun-sql/migrator"

import { connect, MIGRATIONS_FOLDER } from "@/server/db/index.ts"
import { databaseUrl } from "@/server/env.ts"

const url = databaseUrl()
if (url === undefined) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}
const failure = await migrate(connect(url), {
  migrationsFolder: MIGRATIONS_FOLDER,
})
if (failure !== undefined) {
  console.error("migration failed", failure)
  process.exit(1)
}
console.log("migrations applied")
process.exit(0)
