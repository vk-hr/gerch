import { waitUntil } from "@vercel/functions"

import { createAdapters } from "./adapters.ts"
import { createCache, memoryStore, postgresStore } from "./cache.ts"
import { connect } from "./db/index.ts"
import { databaseUrl, release, replayDir } from "./env.ts"
import { nixIndexState } from "./nix/store.ts"
import type { NixIndexState } from "./nix/store.ts"
import type { RefreshFailure } from "./cache.ts"
import { replayDirectory } from "./replay.ts"
import type { SearchDeps } from "./search.ts"
import { postgresVitals } from "./vitals.ts"
import type { VitalStore } from "./vitals.ts"

interface ServerContext extends SearchDeps {
  // The nix index's release and age, for /api/health; null without one.
  nixState: () => Promise<NixIndexState | null>
  // Failed background refreshes, for /api/health.
  refreshFailures: (since: number) => Promise<RefreshFailure[]>
  // Where /api/vitals keeps samples; null drops them (no database).
  vitals: { release: string; store: VitalStore | null }
}

function createContext(): ServerContext {
  const url = databaseUrl()
  const replay = replayDir()
  const db = url === undefined ? undefined : connect(url)
  const store = db === undefined ? memoryStore() : postgresStore(db)
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
      store,
      waitUntil,
    }),
    refreshFailures: store.failures,
    nixState: async () => (db === undefined ? null : nixIndexState(db)),
    vitals: {
      release: release(),
      store: db === undefined ? null : postgresVitals(db),
    },
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
