// Persists successful searches to IndexedDB, so a repeated search renders at
// once after a reload and revalidates in the background (docs/decisions.md
// D15, D27).
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister"
import type { Query, QueryClient } from "@tanstack/react-query"
import { persistQueryClient } from "@tanstack/react-query-persist-client"
import { createStore, del, get, set } from "idb-keyval"

import { version } from "~/package.json" with { type: "json" }

const DAY_MS = 86_400_000
// The spec's stale window for searches.
const STALE_DAYS = 7
const PERSIST_MAX_AGE_MS = STALE_DAYS * DAY_MS

let restored: Promise<void> = Promise.resolve()

function shouldPersistQuery(query: Query): boolean {
  const data: unknown = query.state.data
  return (
    query.state.status === "success" &&
    query.queryKey[0] === "search" &&
    typeof data === "object" &&
    data !== null &&
    "ok" in data &&
    data.ok === true
  )
}

async function settle(restoring: Promise<void>): Promise<void> {
  try {
    await restoring
  } catch (error) {
    console.warn("Restoring the saved search cache failed", error)
  }
}

// Restores the saved cache and saves later changes. Call it after hydration:
// restored data must not change the markup React is hydrating.
function persistQueryCache(queryClient: QueryClient): () => void {
  const store = createStore("gerch", "query-cache")
  const persister = createAsyncStoragePersister({
    storage: {
      getItem: async (key) => get<string>(key, store),
      removeItem: async (key) => del(key, store),
      setItem: async (key, value: string) => set(key, value, store),
    },
  })
  const [stop, restoring] = persistQueryClient({
    buster: version,
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
    maxAge: PERSIST_MAX_AGE_MS,
    persister,
    queryClient,
  })
  restored = settle(restoring)
  return stop
}

// Resolves once a restore that has started finishes, so a search started
// meanwhile reads the restored results instead of waiting for the network.
async function queryCacheRestored(): Promise<void> {
  return restored
}

export {
  PERSIST_MAX_AGE_MS,
  persistQueryCache,
  queryCacheRestored,
  shouldPersistQuery,
}
