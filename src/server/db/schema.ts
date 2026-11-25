import { sql } from "drizzle-orm"
import {
  bigint,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

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

// Postgres full-text vectors. gerch only writes them as generated columns.
const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" })

// Words of a text for search: every run of letters and digits, so
// "python313Packages.requests" gives "python313packages" and "requests".
// The in-memory index splits text the same way (src/server/nix/store.ts).
const words = (expression: ReturnType<typeof sql>) =>
  sql`to_tsvector('simple', regexp_replace(${expression}, '[^[:alnum:]]+', ' ', 'g'))`

// The nix index: one row per package in the nixos-unstable channel dump,
// replaced in one transaction by scripts/ingest-nix.ts (D30).
const nixPackages = pgTable(
  "nix_packages",
  {
    attr: text("attr").primaryKey(),
    description: text("description"),
    homepage: text("homepage"),
    license: text("license"),
    mainProgram: text("main_program"),
    // Attribute path, package name and program.
    nameWords: tsvector("name_words").generatedAlwaysAs(
      words(sql`attr || ' ' || pname || ' ' || coalesce(main_program, '')`)
    ),
    pname: text("pname").notNull(),
    // The names plus the description; searches match these.
    textWords: tsvector("text_words").generatedAlwaysAs(
      words(
        sql`attr || ' ' || pname || ' ' || coalesce(main_program, '') || ' ' || coalesce(description, '')`
      )
    ),
    version: text("version").notNull(),
  },
  (table) => [index("nix_packages_text_words").using("gin", table.textWords)]
)

// Which channel release the nix index holds. One row, keyed by channel.
const nixIndex = pgTable("nix_index", {
  channel: text("channel").primaryKey(),
  etag: text("etag"),
  ingestedAt: timestamp("ingested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  packages: integer("packages").notNull(),
  release: text("release"),
})

export { cacheEntries, nixIndex, nixPackages, rateSlots }
