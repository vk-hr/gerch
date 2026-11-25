import { describe, expect, test } from "vitest"

import type { HistoryEntry } from "@/client/state.ts"
import {
  frecency,
  HALF_LIFE_MS,
  HISTORY_LIMIT,
  rankHistory,
  recordSearch,
} from "@/components/suggestions/frecency.ts"

const NOW = Date.UTC(2026, 10, 25)
const DAY_MS = 86_400_000

function entry(partial: Partial<HistoryEntry>): HistoryEntry {
  return { count: 1, lastUsed: NOW, query: "zod", registry: null, ...partial }
}

describe("frecency()", () => {
  test("halves the count every seven days", () => {
    expect.hasAssertions()
    expect(HALF_LIFE_MS).toBe(7 * DAY_MS)
    expect(frecency(entry({ count: 4 }), NOW)).toBe(4)
    expect(
      frecency(entry({ count: 4, lastUsed: NOW - HALF_LIFE_MS }), NOW)
    ).toBe(2)
    expect(
      frecency(entry({ count: 4, lastUsed: NOW - 2 * HALF_LIFE_MS }), NOW)
    ).toBe(1)
  })

  test("ranks a frequent old search against a rare recent one", () => {
    expect.hasAssertions()
    const old = entry({ count: 8, lastUsed: NOW - 14 * DAY_MS, query: "old" })
    const recent = entry({ count: 1, lastUsed: NOW - DAY_MS, query: "new" })
    const fresh = entry({ count: 3, lastUsed: NOW, query: "fresh" })
    expect(
      rankHistory([recent, old, fresh]).map((item) => item.query)
    ).toStrictEqual(["fresh", "old", "new"])
  })

  test("breaks ties by the most recent use", () => {
    expect.hasAssertions()
    const first = entry({
      count: 2,
      lastUsed: NOW - HALF_LIFE_MS,
      query: "first",
    })
    const second = entry({ count: 1, lastUsed: NOW, query: "second" })
    const ranked = rankHistory([first, second])
    expect(ranked.map((item) => item.query)).toStrictEqual(["second", "first"])
  })
})

describe("recordSearch()", () => {
  test("adds a new search with a count of one", () => {
    expect.hasAssertions()
    expect(
      recordSearch([], { query: " zod ", registry: "npm" }, NOW)
    ).toStrictEqual([entry({ registry: "npm" })])
  })

  test("counts a repeated search, ignoring case, and keeps the latest spelling", () => {
    expect.hasAssertions()
    const history = [entry({ count: 2, lastUsed: NOW - DAY_MS, query: "Zod" })]
    expect(
      recordSearch(history, { query: "zod", registry: null }, NOW)
    ).toStrictEqual([entry({ count: 3, query: "zod" })])
  })

  test("keeps the same text in different registries apart", () => {
    expect.hasAssertions()
    const history = [entry({ registry: null })]
    const recorded = recordSearch(
      history,
      { query: "zod", registry: "npm" },
      NOW
    )
    expect(recorded).toHaveLength(2)
  })

  test("ignores an empty search", () => {
    expect.hasAssertions()
    const history = [entry({})]
    expect(recordSearch(history, { query: "  ", registry: null }, NOW)).toBe(
      history
    )
  })

  test("drops the lowest-ranked searches past the limit", () => {
    expect.hasAssertions()
    const full = Array.from({ length: HISTORY_LIMIT }, (_item, index) =>
      entry({ count: 2, lastUsed: NOW - index, query: `q${index}` })
    )
    const stale = entry({ lastUsed: NOW - 10 * HALF_LIFE_MS, query: "stale" })
    const recorded = recordSearch(
      [...full.slice(1), stale],
      { query: "new", registry: null },
      NOW
    )
    expect(recorded).toHaveLength(HISTORY_LIMIT)
    expect(recorded.map((item) => item.query)).not.toContain("stale")
    expect(recorded.map((item) => item.query)).toContain("new")
  })
})
