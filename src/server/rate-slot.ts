// A queue of send times per upstream, so gerch stays inside a registry's
// rate limit (crates.io: 1 req/s). Each request reserves the next free time
// and waits for it. In production the queue is one Postgres row, so the limit
// holds across every function instance (D13).
import { sql } from "drizzle-orm"

import type { Database } from "./db/index.ts"
import { rateSlots } from "./db/schema.ts"
import type { Fetch } from "./http.ts"

interface Reservation {
  key: string
  intervalMs: number
  // A request that would wait longer than this is refused and takes no
  // place in the queue.
  maxWaitMs: number
}

interface RateSlot {
  // How long to wait before sending, or null when the queue is too long.
  reserve: (reservation: Reservation) => Promise<number | null>
}

class RateLimitedError extends Error {
  public constructor(key: string) {
    super(`${key} rate limit queue is full`)
    this.name = "RateLimitedError"
  }
}

function memorySlot(now: () => number): RateSlot {
  const nextAt = new Map<string, number>()
  return {
    reserve: async ({ intervalMs, key, maxWaitMs }) => {
      const current = now()
      const start = Math.max(nextAt.get(key) ?? current, current)
      if (start - current > maxWaitMs) {
        return null
      }
      nextAt.set(key, start + intervalMs)
      return start - current
    },
  }
}

// The database clock, in epoch milliseconds, so instances with skewed
// clocks still agree on the queue.
const DB_NOW = sql`(extract(epoch from clock_timestamp()) * 1000)::bigint`

// One atomic upsert: take the later of the queue's next time and now, and
// move the queue one interval past it. The WHERE refuses a reservation that
// would wait past maxWaitMs, so it returns no row and changes nothing.
function postgresSlot(db: Database): RateSlot {
  return {
    reserve: async ({ intervalMs, key, maxWaitMs }) => {
      const [row] = await db
        .insert(rateSlots)
        .values({ key, nextAt: sql`${DB_NOW} + ${intervalMs}` })
        .onConflictDoUpdate({
          set: {
            nextAt: sql`greatest(${rateSlots.nextAt}, ${DB_NOW}) + ${intervalMs}`,
          },
          setWhere: sql`${rateSlots.nextAt} - ${DB_NOW} <= ${maxWaitMs}`,
          target: rateSlots.key,
        })
        .returning({
          nextAt: rateSlots.nextAt,
          now: sql<number>`${DB_NOW}`.mapWith(Number),
        })
      if (row === undefined) {
        return null
      }
      return Math.max(row.nextAt - intervalMs - row.now, 0)
    },
  }
}

interface ThrottleOptions extends Reservation {
  slot: RateSlot
  sleep: (ms: number) => Promise<void>
}

// A fetch that waits for its turn in the slot's queue before each request.
function throttledFetch(fetcher: Fetch, options: ThrottleOptions): Fetch {
  const { sleep, slot, ...reservation } = options
  return async (input, init) => {
    const wait = await slot.reserve(reservation)
    if (wait === null) {
      throw new RateLimitedError(reservation.key)
    }
    await sleep(wait)
    return fetcher(input, init)
  }
}

export { memorySlot, postgresSlot, RateLimitedError, throttledFetch }
export type { RateSlot, Reservation }
