// Suggestions under the search box: pinned packages that match the typed
// text, then history by frecency, then the current search's own results
// (docs/decisions.md D27).
import type { HistoryEntry, Pin } from "@/client/state.ts"
import { joinPrefix, parseQuery } from "@/shared/query.ts"
import type { Registry } from "@/shared/registry.ts"

import { rankHistory } from "./frecency.ts"

const MAX_PINS = 3
const MAX_HISTORY = 5
// The cards below show every result; the list offers the first few.
const MAX_RESULTS = 3
const MAX_SUGGESTIONS = 8

interface Suggestion {
  kind: "history" | "pin" | "result"
  registry: Registry | null
  name: string
  // The raw query that choosing the suggestion puts in the search box.
  query: string
}

interface SuggestInput {
  // The raw query in the search box, prefix included.
  query: string
  pins: readonly Pin[]
  history: readonly HistoryEntry[]
  // The current search's results, in page order.
  results: readonly { registry: Registry; name: string }[]
}

function packageSuggestion(
  kind: "pin" | "result",
  item: { registry: Registry; name: string }
): Suggestion {
  return {
    kind,
    name: item.name,
    query: joinPrefix(item.registry, item.name),
    registry: item.registry,
  }
}

function historySuggestion(entry: HistoryEntry): Suggestion {
  return {
    kind: "history",
    name: entry.query,
    query: joinPrefix(entry.registry, entry.query),
    registry: entry.registry,
  }
}

function candidates(
  input: SuggestInput,
  text: string,
  prefix: Registry | null
) {
  const inRegistry = (registry: Registry | null) =>
    prefix === null || registry === prefix
  const startsWithText = (name: string) => name.toLowerCase().startsWith(text)
  const pins = input.pins
    .filter((item) => inRegistry(item.registry) && startsWithText(item.name))
    .slice(0, MAX_PINS)
    .map((item) => packageSuggestion("pin", item))
  const history = rankHistory(input.history)
    .filter((item) => inRegistry(item.registry) && startsWithText(item.query))
    .map((item) => historySuggestion(item))
  const results = input.results
    .filter((item) => inRegistry(item.registry))
    .map((item) => packageSuggestion("result", item))
  return { history, pins, results }
}

function suggest(input: SuggestInput): Suggestion[] {
  const { prefix, text } = parseQuery(input.query)
  if (text === "") {
    return []
  }
  const { history, pins, results } = candidates(
    input,
    text.toLowerCase(),
    prefix
  )
  const seen = new Set([joinPrefix(prefix, text).toLowerCase()])
  const fresh = (item: Suggestion) => {
    const key = item.query.toLowerCase()
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  }
  return [
    ...pins.filter((item) => fresh(item)),
    ...history.filter((item) => fresh(item)).slice(0, MAX_HISTORY),
    ...results.filter((item) => fresh(item)).slice(0, MAX_RESULTS),
  ].slice(0, MAX_SUGGESTIONS)
}

export { suggest }
export type { Suggestion, SuggestInput }
