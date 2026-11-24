import { PGlite } from "@electric-sql/pglite"

import type { Db } from "@/server/db.ts"
import { migrate } from "@/server/migrations.ts"

// A fresh in-process Postgres per test, with the app's migrations applied.
type TestDb = Db & { close: () => Promise<void> }

async function freshDb(): Promise<TestDb> {
  const pg = await PGlite.create()
  const db = {
    close: async () => pg.close(),
    query: async (text: string, params: unknown[] = []) => {
      const result = await pg.query<Record<string, unknown>>(text, params)
      return result.rows
    },
  }
  await migrate(db)
  return db
}

export { freshDb }
export type { TestDb }
