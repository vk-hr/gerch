import { waitUntil } from "@vercel/functions"

import { createCache, memoryStore, postgresStore } from "./cache.ts"
import { connect } from "./db/index.ts"
import type { Database } from "./db/index.ts"
import { databaseUrl, replayDir } from "./env.ts"
import { withTimeout } from "./http.ts"
import type { Fetch } from "./http.ts"
import { memorySlot, postgresSlot, throttledFetch } from "./rate-slot.ts"
import { createCratesAdapter } from "./registries/crates.ts"
import { createNpmAdapter } from "./registries/npm.ts"
import { replayDirectory } from "./replay.ts"
import type { SearchDeps } from "./search.ts"

// The crates.io data access policy allows 1 request per second. A request
// that would queue longer than 8 s fails instead, so a burst of searches
// can't hold function instances open (D28).
const CRATES_LIMIT = { intervalMs: 1000, key: "crates.io", maxWaitMs: 8000 }

function cratesFetch(upstream: Fetch, db: Database | undefined): Fetch {
  return throttledFetch(upstream, {
    ...CRATES_LIMIT,
    sleep: async (ms) => Bun.sleep(ms),
    slot: db === undefined ? memorySlot(Date.now) : postgresSlot(db),
  })
}

function createContext(): SearchDeps {
  const url = databaseUrl()
  const replay = replayDir()
  const db = url === undefined ? undefined : connect(url)
  const network = withTimeout(fetch)
  const upstream = replay === undefined ? network : replayDirectory(replay)
  // Recorded responses never reach crates.io, so replay skips its queue.
  const crates = replay === undefined ? cratesFetch(network, db) : upstream
  return {
    adapters: {
      crate: createCratesAdapter(crates),
      npm: createNpmAdapter(upstream),
    },
    cache: createCache({
      now: Date.now,
      onError: (error) => {
        console.error("cache refresh failed", error)
      },
      store: db === undefined ? memoryStore() : postgresStore(db),
      waitUntil,
    }),
  }
}

// One context per server instance. Without DATABASE_URL (local dev) the cache
// and the crates.io queue live in memory; Vercel sets DATABASE_URL to the
// Supabase pooler.
const context = createContext()

function serverContext(): SearchDeps {
  return context
}

export { serverContext }
