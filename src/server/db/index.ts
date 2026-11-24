import { SQL } from "bun"
import { drizzle } from "drizzle-orm/bun-sql"
import type { PgAsyncDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"

// Any Drizzle Postgres database: Bun.SQL in production, PGlite in tests.
type Database = PgAsyncDatabase<PgQueryResultHKT>

const MIGRATIONS_FOLDER = "drizzle"

function connect(url: string) {
  // The Supabase transaction pooler doesn't support prepared statements.
  return drizzle({ client: new SQL(url, { prepare: false }) })
}

export { connect, MIGRATIONS_FOLDER }
export type { Database }
