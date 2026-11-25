import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"

import { MIGRATIONS_FOLDER } from "@/server/db/index.ts"
import {
  cacheEntries,
  nixIndex,
  nixPackages,
  rateSlots,
} from "@/server/db/schema.ts"

// An in-process Postgres with the app's migrations applied.
async function freshDb() {
  const client = await PGlite.create()
  const db = drizzle({ client })
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  return {
    close: async () => client.close(),
    db,
    empty: async () => {
      await db.delete(cacheEntries)
      await db.delete(rateSlots)
      await db.delete(nixPackages)
      await db.delete(nixIndex)
    },
  }
}

type TestDb = Awaited<ReturnType<typeof freshDb>>

export { freshDb }
export type { TestDb }
