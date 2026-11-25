import { useSearch } from "@tanstack/react-router"
import { useEffect } from "react"

import { updateClientState } from "@/client/use-client-state.ts"
import { parseQuery } from "@/shared/query.ts"

import { recordSearch } from "./frecency.ts"

// The URL takes the query 150 ms after typing pauses, so it passes through
// "r", "re", "rea" on the way to "react". A search counts once it has stayed
// in the URL this long (docs/decisions.md D27).
const SETTLE_MS = 1000

// Records each committed search (the `q` in the URL) in the saved history.
function useSearchHistory() {
  const committed = useSearch({ select: (search) => search.q, strict: false })
  useEffect(() => {
    const { prefix, text } = parseQuery(committed ?? "")
    const record = () => {
      updateClientState((state) => ({
        ...state,
        history: recordSearch(
          state.history,
          { query: text, registry: prefix },
          Date.now()
        ),
      }))
    }
    const timer = text === "" ? undefined : setTimeout(record, SETTLE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [committed])
}

export { useSearchHistory }
