// Persists successful searches to IndexedDB, so a repeated search renders at
// once after a reload and revalidates in the background (docs/decisions.md
// D15, D27).
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister"
import type { Query, QueryClient } from "@tanstack/react-query"
import type { Persister } from "@tanstack/react-query-persist-client"
import {
  persistQueryClient,
  persistQueryClientSave,
} from "@tanstack/react-query-persist-client"
import { createStore, del, get, set } from "idb-keyval"

import { version } from "~/package.json" with { type: "json" }

const DAY_MS = 86_400_000
// The spec's stale window for searches.
const STALE_DAYS = 7
const PERSIST_MAX_AGE_MS = STALE_DAYS * DAY_MS

let restored: Promise<void> = Promise.resolve()

function withinWindow(updatedAt: number): boolean {
  return Date.now() - updatedAt <= PERSIST_MAX_AGE_MS
}

function shouldPersistQuery(query: Query): boolean {
  const data: unknown = query.state.data
  return (
    withinWindow(query.state.dataUpdatedAt) &&
    query.queryKey[0] === "search" &&
    typeof data === "object" &&
    data !== null &&
    "ok" in data &&
    data.ok === true
  )
}

async function settle(
  restoring: Promise<void>,
  save: () => Promise<void>
): Promise<void> {
  try {
    await restoring
    await save()
  } catch (error) {
    console.warn("Restoring the saved search cache failed", error)
  }
}

// Restores the saved cache and saves later changes. Call it after hydration:
// restored data must not change the markup React is hydrating.
function createPersister(): Persister {
  const store = createStore("gerch", "query-cache")
  const persister = createAsyncStoragePersister({
    storage: {
      getItem: async (key) => get<string>(key, store),
      removeItem: async (key) => del(key, store),
      setItem: async (key, value: string) => set(key, value, store),
    },
  })
  return {
    ...persister,
    restoreClient: async () => {
      const saved = await persister.restoreClient()
      if (saved !== undefined) {
        saved.clientState.queries = saved.clientState.queries.filter((query) =>
          withinWindow(query.state.dataUpdatedAt)
        )
        for (const query of saved.clientState.queries) {
          query.state.status = "success"
          query.state.error = null
        }
      }
      return saved
    },
  }
}

function persistQueryCache(queryClient: QueryClient): () => void {
  const options = {
    buster: version,
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
    maxAge: PERSIST_MAX_AGE_MS,
    persister: createPersister(),
    queryClient,
  }
  const [stop, restoring] = persistQueryClient(options)
  restored = settle(restoring, async () => persistQueryClientSave(options))
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
