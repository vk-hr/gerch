// Shared stale-while-revalidate cache (docs/spec.md, "Cache"). A fresh entry
// is a hit. A stale entry is returned at once while one background refresh
// runs. A missing or expired entry waits for the load.
import { eq, sql } from "drizzle-orm"

import type { Database } from "./db/index.ts"
import { cacheEntries } from "./db/schema.ts"

interface CacheEntry {
  value: unknown
  freshUntil: number
  staleUntil: number
}

interface CacheStore {
  get: (key: string) => Promise<CacheEntry | null>
  set: (key: string, entry: CacheEntry) => Promise<void>
}

interface CachePolicy {
  freshMs: number
  staleMs: number
}

type CacheState = "hit" | "stale" | "miss"

interface CacheRequest<TValue> {
  key: string
  policy: CachePolicy
  load: () => Promise<TValue>
  parse: (value: unknown) => TValue
}

interface CacheDeps {
  store: CacheStore
  now: () => number
  waitUntil: (promise: Promise<unknown>) => void
  onError: (error: unknown) => void
}

interface Cache {
  get: <TValue>(
    request: CacheRequest<TValue>
  ) => Promise<{ value: TValue; state: CacheState }>
}

function memoryStore(): CacheStore {
  const entries = new Map<string, CacheEntry>()
  return {
    get: async (key) => entries.get(key) ?? null,
    set: async (key, entry) => {
      entries.set(key, entry)
    },
  }
}

function postgresStore(db: Database): CacheStore {
  return {
    get: async (key) => {
      const [row] = await db
        .select({
          freshUntil: cacheEntries.freshUntil,
          staleUntil: cacheEntries.staleUntil,
          value: cacheEntries.value,
        })
        .from(cacheEntries)
        .where(eq(cacheEntries.key, key))
      return row ?? null
    },
    set: async (key, entry) => {
      await db
        .insert(cacheEntries)
        .values({ key, ...entry })
        .onConflictDoUpdate({
          set: { ...entry, updatedAt: sql`now()` },
          target: cacheEntries.key,
        })
    },
  }
}

async function loadAndStore<TValue>(
  deps: CacheDeps,
  request: CacheRequest<TValue>
): Promise<TValue> {
  const value = await request.load()
  const now = deps.now()
  await deps.store.set(request.key, {
    freshUntil: now + request.policy.freshMs,
    staleUntil: now + request.policy.freshMs + request.policy.staleMs,
    value,
  })
  return value
}

// One load per key at a time within this instance.
function singleFlight(deps: CacheDeps) {
  const inflight = new Map<string, Promise<unknown>>()
  return async function refresh<TValue>(
    request: CacheRequest<TValue>
  ): Promise<TValue> {
    const running = inflight.get(request.key)
    if (running !== undefined) {
      return request.parse(await running)
    }
    const promise = loadAndStore(deps, request)
    inflight.set(request.key, promise)
    try {
      return await promise
    } finally {
      inflight.delete(request.key)
    }
  }
}

function createCache(deps: CacheDeps): Cache {
  const refresh = singleFlight(deps)

  async function backgroundRefresh<TValue>(
    request: CacheRequest<TValue>
  ): Promise<void> {
    try {
      await refresh(request)
    } catch (error) {
      deps.onError(error)
    }
  }

  return {
    get: async (request) => {
      const entry = await deps.store.get(request.key)
      const now = deps.now()
      if (entry !== null && now < entry.freshUntil) {
        return { state: "hit", value: request.parse(entry.value) }
      }
      if (entry !== null && now < entry.staleUntil) {
        deps.waitUntil(backgroundRefresh(request))
        return { state: "stale", value: request.parse(entry.value) }
      }
      return { state: "miss", value: await refresh(request) }
    },
  }
}

export { createCache, memoryStore, postgresStore }
export type { Cache, CachePolicy, CacheState, CacheStore }
