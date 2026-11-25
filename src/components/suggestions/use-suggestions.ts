import { useQueries } from "@tanstack/react-query"

import { useClientState } from "@/client/use-client-state.ts"
import { searchQuery } from "@/lib/search.ts"
import { parseQuery } from "@/shared/query.ts"
import type { Registry } from "@/shared/registry.ts"

import { suggest } from "./suggest.ts"
import type { Suggestion } from "./suggest.ts"

// The cached results of the search for the typed text, once it has run.
// Reading them never starts a request.
function useLiveResults(query: string): { registry: Registry; name: string }[] {
  const { registries, text } = parseQuery(query)
  const available = text === "" ? [] : registries
  return useQueries({
    combine: (found) =>
      found.flatMap(({ data }) => (data?.ok === true ? data.body.results : [])),
    queries: available.map((registry) =>
      Object.assign(searchQuery(registry, text), { enabled: false })
    ),
  })
}

function useSuggestions(query: string): Suggestion[] {
  const workspaces = useClientState((state) => state.workspaces)
  const history = useClientState((state) => state.history)
  const results = useLiveResults(query)
  return suggest({
    history,
    pins: workspaces.flatMap((workspace) => workspace.pins),
    query,
    results,
  })
}

export { useSuggestions }
