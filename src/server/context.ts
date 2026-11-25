import { waitUntil } from "@vercel/functions"

import { createAdapters } from "./adapters.ts"
import { createCache, memoryStore, postgresStore } from "./cache.ts"
import { connect } from "./db/index.ts"
import { databaseUrl, replayDir } from "./env.ts"
import { nixIndexState } from "./nix/store.ts"
import type { NixIndexState } from "./nix/store.ts"
import { replayDirectory } from "./replay.ts"
import type { SearchDeps } from "./search.ts"

interface ServerContext extends SearchDeps {
  // The nix index's release and age, for /api/health; null without one.
  nixState: () => Promise<NixIndexState | null>
}

function createContext(): ServerContext {
  const url = databaseUrl()
  const replay = replayDir()
  const db = url === undefined ? undefined : connect(url)
  return {
    adapters: createAdapters(
      db,
      replay === undefined ? undefined : replayDirectory(replay)
    ),
    cache: createCache({
      now: Date.now,
      onError: (error) => {
        console.error("cache refresh failed", error)
      },
      store: db === undefined ? memoryStore() : postgresStore(db),
      waitUntil,
    }),
    nixState: async () => (db === undefined ? null : nixIndexState(db)),
  }
}

// One context per server instance. Without DATABASE_URL (local dev) the cache
// and the crates.io queue live in memory; Vercel sets DATABASE_URL to the
// Supabase pooler.
const context = createContext()

function serverContext(): ServerContext {
  return context
}

export { serverContext }
