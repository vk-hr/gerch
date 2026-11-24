import type { Db } from "./db.ts"

const MIGRATIONS = [
  {
    id: "0001_cache_entries",
    sql: `create table cache_entries (
      key text primary key,
      value jsonb not null,
      fresh_until bigint not null,
      stale_until bigint not null,
      updated_at timestamptz not null default now()
    )`,
  },
] as const

async function migrate(db: Db): Promise<string[]> {
  await db.query(
    "create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())"
  )
  const rows = await db.query("select id from schema_migrations")
  const applied = new Set(rows.map((row) => String(row.id)))
  const pending = MIGRATIONS.filter((migration) => !applied.has(migration.id))
  // Each migration depends on the ones before it, so they run in order.
  await pending.reduce(async (previous, migration) => {
    await previous
    await db.query(migration.sql)
    await db.query("insert into schema_migrations (id) values ($1)", [
      migration.id,
    ])
  }, Promise.resolve())
  return pending.map((migration) => migration.id)
}

export { migrate }
