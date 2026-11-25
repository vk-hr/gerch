// Shared stale-while-revalidate cache (docs/spec.md, "Cache"). A fresh entry
// is a hit. A stale entry is returned at once while one background refresh
// runs. A missing or expired entry waits for the load.
import { eq, gte, sql } from "drizzle-orm"

import type { Database } from "./db/index.ts"
import { cacheEntries } from "./db/schema.ts"

interface CacheEntry {
  value: unknown
  freshUntil: number
  staleUntil: number
}

// A failed background refresh: the registry is the second part of the key
// ("search:npm:zod").
interface RefreshFailure {
  registry: string
  message: string
  at: number
}

interface CacheStore {
  get: (key: string) => Promise<CacheEntry | null>
  // Storing a value also clears the key's recorded failure.
  set: (key: string, entry: CacheEntry) => Promise<void>
  markFailed: (key: string, message: string, at: number) => Promise<void>
  // The latest failure per registry at or after `since`.
  failures: (since: number) => Promise<RefreshFailure[]>
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

// The latest failure of each registry, sorted by registry.
function latestPerRegistry(
  failed: readonly { key: string; message: string; at: number }[]
): RefreshFailure[] {
  const latest = new Map<string, RefreshFailure>()
  for (const { at, key, message } of failed) {
    const registry = key.split(":")[1] ?? key
    if ((latest.get(registry)?.at ?? -1) < at) {
      latest.set(registry, { at, message, registry })
    }
  }
  return [...latest.values()].toSorted((left, right) =>
    left.registry.localeCompare(right.registry)
  )
}

function memoryStore(): CacheStore {
  const entries = new Map<string, CacheEntry>()
  const failed = new Map<string, { message: string; at: number }>()
  return {
    failures: async (since) =>
      latestPerRegistry(
        [...failed]
          .filter(([, failure]) => failure.at >= since)
          .map(([key, { at, message }]) => ({ at, key, message }))
      ),
    get: async (key) => entries.get(key) ?? null,
    markFailed: async (key, message, at) => {
      failed.set(key, { at, message })
    },
    set: async (key, entry) => {
      entries.set(key, entry)
      failed.delete(key)
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
    failures: async (since) => {
      const rows = await db
        .select({
          at: cacheEntries.refreshFailedAt,
          key: cacheEntries.key,
          message: cacheEntries.refreshError,
        })
        .from(cacheEntries)
        .where(gte(cacheEntries.refreshFailedAt, since))
      return latestPerRegistry(
        rows.map((row) => ({
          at: row.at ?? 0,
          key: row.key,
          message: row.message ?? "",
        }))
      )
    },
    markFailed: async (key, message, at) => {
      await db
        .update(cacheEntries)
        .set({ refreshError: message, refreshFailedAt: at })
        .where(eq(cacheEntries.key, key))
    },
    set: async (key, entry) => {
      const cleared = { refreshError: null, refreshFailedAt: null }
      await db
        .insert(cacheEntries)
        .values({ key, ...entry, ...cleared })
        .onConflictDoUpdate({
          set: { ...entry, ...cleared, updatedAt: sql`now()` },
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
      const message = error instanceof Error ? error.message : String(error)
      await deps.store
        .markFailed(request.key, message, deps.now())
        .catch(deps.onError)
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
export type { Cache, CachePolicy, CacheState, CacheStore, RefreshFailure }
