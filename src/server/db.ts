// The one database surface the server uses. Production wraps Bun.SQL;
// tests wrap PGlite (test/support/pglite.ts).
interface Db {
  query: (
    text: string,
    params?: unknown[]
  ) => Promise<Record<string, unknown>[]>
}

function bunSqlDb(url: string): Db {
  // The Supabase transaction pooler doesn't support prepared statements.
  const sql = new Bun.SQL(url, { prepare: false })
  return {
    query: async (text, params = []) => sql.unsafe(text, params),
  }
}

export { bunSqlDb }
export type { Db }
