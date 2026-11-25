import { createFileRoute } from "@tanstack/react-router"

import { queryCacheRestored } from "@/client/query-persister.ts"
import { SearchPage } from "@/components/search/search-page.tsx"
import { startSearch } from "@/lib/search.ts"
import { parseQuery } from "@/shared/query.ts"
import { isAvailable } from "@/shared/registry.ts"

export const Route = createFileRoute("/")({
  // `q` is optional: a required key makes the router redirect `/` to `/?q=`.
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search.q === "string" && search.q !== "" ? { q: search.q } : {},
  loaderDeps: ({ search }) => ({ query: search.q ?? "" }),
  // Start every registry's search while the page streams; each section
  // suspends on its own query, so the slowest registry never blocks the rest.
  loader: async ({ context, deps }) => {
    const { registries, text } = parseQuery(deps.query)
    if (text === "") {
      return
    }
    // A search right after a reload reads the restored cache (D27).
    await queryCacheRestored()
    for (const registry of registries.filter((candidate) =>
      isAvailable(candidate)
    )) {
      void startSearch(context.queryClient, registry, text)
    }
  },
  component: SearchRoute,
})

function SearchRoute() {
  const { q: query = "" } = Route.useSearch()
  return <SearchPage query={query} />
}
