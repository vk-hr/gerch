import { afterAll, afterEach, describe, expect, test } from "vitest"

import { withTimeout } from "@/server/http.ts"
import type { Fetch } from "@/server/http.ts"
import {
  memorySlot,
  postgresSlot,
  RateLimitedError,
  throttledFetch,
} from "@/server/rate-slot.ts"
import type { RateSlot } from "@/server/rate-slot.ts"

import { freshDb } from "../support/pglite.ts"
import type { TestDb } from "../support/pglite.ts"

const SECOND = { intervalMs: 1000, key: "crate", maxWaitMs: 5000 }

const database: { db?: TestDb } = {}

async function testDb(): Promise<TestDb> {
  database.db ??= await freshDb()
  return database.db
}

// One reservation after another, each queued behind the last.
async function reserveMany(slot: RateSlot, count: number) {
  return Array.from({ length: count }).reduce<Promise<(number | null)[]>>(
    async (previous) => [...(await previous), await slot.reserve(SECOND)],
    Promise.resolve([])
  )
}

describe("memory slot", () => {
  test("spaces reservations one interval apart", async () => {
    expect.hasAssertions()
    const clock = { now: 0 }
    const slot = memorySlot(() => clock.now)
    await expect(reserveMany(slot, 3)).resolves.toStrictEqual([0, 1000, 2000])
    clock.now = 10_000
    await expect(slot.reserve(SECOND)).resolves.toBe(0)
  })

  test("refuses a reservation that would wait longer than allowed", async () => {
    expect.hasAssertions()
    const slot = memorySlot(() => 0)
    const waits = await reserveMany(slot, 7)
    expect(waits).toStrictEqual([0, 1000, 2000, 3000, 4000, 5000, null])
    // A refused reservation takes no place in the queue.
    await expect(slot.reserve({ ...SECOND, maxWaitMs: 6000 })).resolves.toBe(
      6000
    )
  })

  test("keeps separate queues per key", async () => {
    expect.hasAssertions()
    const slot = memorySlot(() => 0)
    await slot.reserve(SECOND)
    await expect(slot.reserve({ ...SECOND, key: "other" })).resolves.toBe(0)
  })
})

describe("postgres slot", () => {
  afterEach(async () => {
    await database.db?.empty()
  })

  afterAll(async () => {
    await database.db?.close()
  })

  test("two instances share one queue", async () => {
    expect.hasAssertions()
    const { db } = await testDb()
    const first = postgresSlot(db)
    const second = postgresSlot(db)
    const waits = [
      await first.reserve(SECOND),
      await second.reserve(SECOND),
      await first.reserve(SECOND),
    ]
    // The database clock moves on between statements, so each wait is a
    // little under its full interval.
    expect(waits[0]).toBe(0)
    expect(waits[1]).toBeGreaterThan(900)
    expect(waits[1]).toBeLessThanOrEqual(1000)
    expect(waits[2]).toBeGreaterThan(1900)
    expect(waits[2]).toBeLessThanOrEqual(2000)
  })

  test("refuses a reservation past the longest wait", async () => {
    expect.hasAssertions()
    const { db } = await testDb()
    const slot = postgresSlot(db)
    const tight = { ...SECOND, maxWaitMs: 1500 }
    const waits = [
      await slot.reserve(tight),
      await slot.reserve(tight),
      await slot.reserve(tight),
    ]
    expect(waits[0]).toBe(0)
    expect(waits[1]).toBeGreaterThan(900)
    expect(waits[2]).toBeNull()
  })
})

const ok: Fetch = async (input) => Response.json({ input })

describe("throttled fetch", () => {
  test("waits for its reservation before each request", async () => {
    expect.hasAssertions()
    const slept: number[] = []
    const sent: string[] = []
    const fetcher = throttledFetch(
      async (input, init) => {
        sent.push(`${input} after ${slept.join(",")}`)
        return ok(input, init)
      },
      {
        ...SECOND,
        sleep: async (ms) => {
          slept.push(ms)
        },
        slot: memorySlot(() => 0),
      }
    )
    await fetcher("https://crates.io/a")
    await fetcher("https://crates.io/b")
    expect(sent).toStrictEqual([
      "https://crates.io/a after 0",
      "https://crates.io/b after 0,1000",
    ])
  })

  // The upstream timeout covers the request, not the wait for a turn.
  test("starts the request timeout after the queue wait", async () => {
    expect.hasAssertions()
    const seen: (AbortSignal | null | undefined)[] = []
    const fetcher = throttledFetch(
      withTimeout(async (input, init) => {
        seen.push(init?.signal)
        return ok(input, init)
      }, 20),
      {
        ...SECOND,
        sleep: async () => Bun.sleep(40),
        slot: memorySlot(() => 0),
      }
    )
    await fetcher("https://crates.io/a")
    expect(seen.map((signal) => signal?.aborted)).toStrictEqual([false])
  })

  test("rejects without a request when the queue is full", async () => {
    expect.hasAssertions()
    const sent: string[] = []
    const fetcher = throttledFetch(
      async (input, init) => {
        sent.push(input)
        return ok(input, init)
      },
      {
        ...SECOND,
        maxWaitMs: 0,
        sleep: async () => {
          // The test clock never moves.
        },
        slot: memorySlot(() => 0),
      }
    )
    await fetcher("https://crates.io/a")
    await expect(fetcher("https://crates.io/b")).rejects.toBeInstanceOf(
      RateLimitedError
    )
    expect(sent).toStrictEqual(["https://crates.io/a"])
  })
})
