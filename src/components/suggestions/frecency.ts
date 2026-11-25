// Ranks search history by frecency: how often a search ran, halved for every
// week since it last ran (docs/spec.md, "Suggestions").
import type { HistoryEntry } from "@/client/state.ts"
import type { Registry } from "@/shared/registry.ts"

const DAY_MS = 86_400_000
const HALF_LIFE_DAYS = 7
const HALF_LIFE_MS = HALF_LIFE_DAYS * DAY_MS
const HALF = 0.5
// Enough for weeks of searching, small enough to rank on every keystroke.
const HISTORY_LIMIT = 100

interface Search {
  query: string
  registry: Registry | null
}

function frecency(entry: HistoryEntry, now: number): number {
  const age = Math.max(0, now - entry.lastUsed)
  return entry.count * HALF ** (age / HALF_LIFE_MS)
}

// Most frecent first. Every score shares the same decay since the newest
// entry, so ranks don't depend on the current time; the newest entry stands
// in for it, which keeps ranking pure.
function rankHistory(history: readonly HistoryEntry[]): HistoryEntry[] {
  const now = Math.max(0, ...history.map((entry) => entry.lastUsed))
  return history.toSorted(
    (first, second) =>
      frecency(second, now) - frecency(first, now) ||
      second.lastUsed - first.lastUsed
  )
}

function sameSearch(entry: HistoryEntry, search: Search): boolean {
  return (
    entry.registry === search.registry &&
    entry.query.toLowerCase() === search.query.toLowerCase()
  )
}

// Counts one more run of a search, or adds it. Past the limit, the
// lowest-ranked searches go.
function recordSearch(
  history: HistoryEntry[],
  search: Search,
  now: number
): HistoryEntry[] {
  const query = search.query.trim()
  if (query === "") {
    return history
  }
  const current = { query, registry: search.registry }
  const previous = history.find((entry) => sameSearch(entry, current))
  const next: HistoryEntry = {
    count: (previous?.count ?? 0) + 1,
    lastUsed: now,
    ...current,
  }
  const rest = history.filter((entry) => entry !== previous)
  return [next, ...rankHistory(rest).slice(0, HISTORY_LIMIT - 1)]
}

export { frecency, HALF_LIFE_MS, HISTORY_LIMIT, rankHistory, recordSearch }
export type { Search }
