import type { QueryClient } from "@tanstack/react-query"

import type { SearchResult } from "@/lib/search.ts"
import type { Registry } from "@/shared/registry.ts"

// The npm package endpoint gerch reads has no release date; only search
// results carry one (D25). So a package page borrows the date from any
// cached search that listed the same package, and shows none otherwise.
function cachedReleaseDate(
  queryClient: QueryClient,
  registry: Registry,
  name: string
): string | null {
  const searches = queryClient.getQueriesData<SearchResult>({
    queryKey: ["search", registry],
  })
  for (const [, data] of searches) {
    const hit = data?.ok === true ? data.body.results : []
    const releasedAt = hit.find((result) => result.name === name)?.releasedAt
    if (releasedAt !== undefined && releasedAt !== null) {
      return releasedAt
    }
  }
  return null
}

export { cachedReleaseDate }
