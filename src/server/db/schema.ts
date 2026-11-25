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

// One row per rate-limited upstream: the earliest time (epoch ms, database
// clock) the next request may go out. Every function instance reserves its
// turn here, so the limit holds across instances (src/server/rate-slot.ts).
const rateSlots = pgTable("rate_slots", {
  key: text("key").primaryKey(),
  nextAt: bigint("next_at", { mode: "number" }).notNull(),
})

export { cacheEntries, rateSlots }
