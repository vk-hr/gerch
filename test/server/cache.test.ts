import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest"

import { createCache, memoryStore, postgresStore } from "@/server/cache.ts"
import type { CacheStore } from "@/server/cache.ts"

import { freshDb } from "../support/pglite.ts"
import type { TestDb } from "../support/pglite.ts"

const policy = { freshMs: 1000, staleMs: 5000 }
// One throwaway database for this file, emptied after every test.
const database: { db?: TestDb } = {}

function asNumber(value: unknown): number {
  if (typeof value !== "number") {
    throw new TypeError("not a number")
  }
  return value
}

function request(key: string, load: () => Promise<number>) {
  return { key, load, parse: asNumber, policy }
}

function constant(value: number): () => Promise<number> {
  return async () => value
}

async function failing(): Promise<number> {
  throw new Error("upstream down")
}

async function postgres(): Promise<CacheStore> {
  database.db ??= await freshDb()
  return postgresStore(database.db)
}

function harness(store: CacheStore) {
  const clock = { now: 0 }
  const background: Promise<unknown>[] = []
  const errors: unknown[] = []
  const cache = createCache({
    now: () => clock.now,
    onError: (error) => {
      errors.push(error)
    },
    store,
    waitUntil: (promise) => {
      background.push(promise)
    },
  })
  return { background, cache, clock, errors }
}

describe.each([
  ["memory", async () => memoryStore()],
  ["postgres", postgres],
])("stale-while-revalidate cache with the %s store", (_name, makeStore) => {
  beforeAll(async () => {
    database.db = await freshDb()
  })

  afterEach(async () => {
    await database.db?.query("truncate cache_entries")
  })

  afterAll(async () => {
    await database.db?.close()
    delete database.db
  })

  test("a miss loads and stores; the next read is a hit", async () => {
    expect.hasAssertions()
    const { cache } = harness(await makeStore())
    let loads = 0
    const load = async () => {
      loads += 1
      return 42
    }
    const read1 = cache.get(request("k", load))
    await expect(read1).resolves.toStrictEqual({
      state: "miss",
      value: 42,
    })
    const read2 = cache.get(request("k", load))
    await expect(read2).resolves.toStrictEqual({
      state: "hit",
      value: 42,
    })
    expect(loads).toBe(1)
  })

  test("a stale read returns the old value and refreshes in the background", async () => {
    expect.hasAssertions()
    const { background, cache, clock } = harness(await makeStore())
    await cache.get(request("k", constant(1)))
    clock.now = 2000
    const read3 = cache.get(request("k", constant(2)))
    await expect(read3).resolves.toStrictEqual({
      state: "stale",
      value: 1,
    })
    expect(background).toHaveLength(1)
    await Promise.all(background)
    const read4 = cache.get(request("k", constant(3)))
    await expect(read4).resolves.toStrictEqual({
      state: "hit",
      value: 2,
    })
  })

  test("past the stale window a read is a miss again", async () => {
    expect.hasAssertions()
    const { cache, clock } = harness(await makeStore())
    await cache.get(request("k", constant(1)))
    clock.now = 6001
    const read5 = cache.get(request("k", constant(2)))
    await expect(read5).resolves.toStrictEqual({
      state: "miss",
      value: 2,
    })
  })

  test("concurrent misses for one key load once", async () => {
    expect.hasAssertions()
    const { cache } = harness(await makeStore())
    let loads = 0
    const load = async () => {
      loads += 1
      await Bun.sleep(5)
      return 7
    }
    const results = await Promise.all([
      cache.get(request("k", load)),
      cache.get(request("k", load)),
    ])
    expect(results.map((result) => result.value)).toStrictEqual([7, 7])
    expect(loads).toBe(1)
  })

  test("a failed background refresh keeps the stale value and reports the error", async () => {
    expect.hasAssertions()
    const { background, cache, clock, errors } = harness(await makeStore())
    await cache.get(request("k", constant(1)))
    clock.now = 2000
    const read6 = cache.get(request("k", failing))
    await expect(read6).resolves.toStrictEqual({
      state: "stale",
      value: 1,
    })
    await Promise.all(background)
    expect(errors).toHaveLength(1)
    const read7 = cache.get(request("k", failing))
    await expect(read7).resolves.toStrictEqual({
      state: "stale",
      value: 1,
    })
  })

  test("a failed load on a miss rejects", async () => {
    expect.hasAssertions()
    const { cache } = harness(await makeStore())
    const read = cache.get(request("k", failing))
    await expect(read).rejects.toThrow("upstream down")
  })
})
