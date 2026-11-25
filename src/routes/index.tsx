import { createFileRoute } from "@tanstack/react-router"

import { CopiedProvider } from "@/components/search/copied-provider.tsx"
import { SearchPage } from "@/components/search/search-page.tsx"
import { startSearch } from "@/lib/search.ts"
import { parseQuery } from "@/shared/query.ts"
import { isAvailable } from "@/shared/registry.ts"

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  loaderDeps: ({ search }) => ({ query: search.q }),
  // Start every registry's search while the page streams; each section
  // suspends on its own query, so the slowest registry never blocks the rest.
  loader: ({ context, deps }) => {
    const { registries, text } = parseQuery(deps.query)
    if (text === "") {
      return
    }
    for (const registry of registries.filter((candidate) =>
      isAvailable(candidate)
    )) {
      void startSearch(context.queryClient, registry, text)
    }
  },
  component: SearchRoute,
})

function SearchRoute() {
  const { q: query } = Route.useSearch()
  return (
    <CopiedProvider>
      <SearchPage query={query} />
    </CopiedProvider>
  )
}
