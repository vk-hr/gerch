import type { QueryClient } from "@tanstack/react-query"

import type { SearchResult } from "@/lib/search.ts"

import type { CachedResults } from "./workspaces.ts"

// Every successful search in the query cache (`["search", registry, text]`),
// with when it was fetched.
function cachedResults(queryClient: QueryClient): CachedResults[] {
  return queryClient
    .getQueriesData<SearchResult>({ queryKey: ["search"] })
    .flatMap(([queryKey, data]) =>
      data?.ok === true
        ? [
            {
              results: data.body.results,
              updatedAt:
                queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0,
            },
          ]
        : []
    )
}

export { cachedResults }
