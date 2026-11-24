import { bigint, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

// The shared stale-while-revalidate cache (src/server/cache.ts). Times are
// epoch milliseconds, compared against the server clock.
const cacheEntries = pgTable("cache_entries", {
  freshUntil: bigint("fresh_until", { mode: "number" }).notNull(),
  key: text("key").primaryKey(),
  staleUntil: bigint("stale_until", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  value: jsonb("value").notNull(),
})

export { cacheEntries }
