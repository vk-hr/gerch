import { waitUntil } from "@vercel/functions"

import { createCache, memoryStore, postgresStore } from "./cache.ts"
import { connect } from "./db/index.ts"
import { databaseUrl } from "./env.ts"
import { createNpmAdapter } from "./registries/npm.ts"
import type { SearchDeps } from "./search.ts"

function createContext(): SearchDeps {
  const url = databaseUrl()
  return {
    adapters: { npm: createNpmAdapter(fetch) },
    cache: createCache({
      now: Date.now,
      onError: (error) => {
        console.error("cache refresh failed", error)
      },
      store: url === undefined ? memoryStore() : postgresStore(connect(url)),
      waitUntil,
    }),
  }
}

// One context per server instance. Without DATABASE_URL (local dev) the cache
// lives in memory; Vercel sets DATABASE_URL to the Supabase pooler.
const context = createContext()

function serverContext(): SearchDeps {
  return context
}

export { serverContext }
