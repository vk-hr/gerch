import { CancelledError, queryOptions } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"

import { isRegistry, REGISTRY_LABELS } from "@/shared/registry.ts"
import type { Registry, SearchResponse } from "@/shared/registry.ts"

type SearchResult =
  { ok: true; body: SearchResponse } | { ok: false; message: string }

interface SearchInput {
  registry: Registry
  q: string
}

const STALE_MS = 60_000

function validateSearchInput(input: unknown): SearchInput {
  if (
    typeof input === "object" &&
    input !== null &&
    "registry" in input &&
    typeof input.registry === "string" &&
    isRegistry(input.registry) &&
    "q" in input &&
    typeof input.q === "string"
  ) {
    return { q: input.q, registry: input.registry }
  }
  throw new TypeError("expected { registry, q }")
}

// The app's typed path to /api/search's logic: same cache, same results, and
// CDN cache headers on the GET response. A failed search is returned as data:
// production builds redact the messages of thrown server errors.
const searchRegistry = createServerFn({ method: "GET" })
  .validator(validateSearchInput)
  .handler(async ({ data }): Promise<SearchResult> => {
    const [
      { setResponseHeaders },
      { serverContext },
      { CDN_CACHE, runSearch },
    ] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("@/server/context.ts"),
      import("@/server/search.ts"),
    ])
    const outcome = await runSearch(serverContext(), data.registry, data.q)
    if (!outcome.ok) {
      setResponseHeaders(new Headers({ "cache-control": "no-store" }))
      return { message: outcome.message, ok: false }
    }
    setResponseHeaders(new Headers({ "cache-control": CDN_CACHE }))
    return { body: outcome.body, ok: true }
  })

// A request that never reaches the server (offline, a deploy in progress) is
// a failure like any other: its section shows it with a Retry button.
async function fetchSearch(
  registry: Registry,
  text: string
): Promise<SearchResult> {
  try {
    return await searchRegistry({ data: { q: text, registry } })
  } catch {
    return { message: `${REGISTRY_LABELS[registry]} is unavailable`, ok: false }
  }
}

function searchQuery(registry: Registry, text: string) {
  return queryOptions({
    queryFn: async () => fetchSearch(registry, text),
    queryKey: ["search", registry, text.trim().toLowerCase()],
    // A failure is stale at once, so coming back to it searches again.
    staleTime: ({ state }) => (state.data?.ok === false ? 0 : STALE_MS),
  })
}

// Starts a search without waiting for it, so the page streams while the
// registry answers. Each section reads the result with useSuspenseQuery.
async function startSearch(
  queryClient: QueryClient,
  registry: Registry,
  text: string
): Promise<void> {
  try {
    await queryClient.query(searchQuery(registry, text))
  } catch (error) {
    // The query function returns failures as data, so only a cancelled
    // query rejects here; anything else is a bug worth logging.
    if (!(error instanceof CancelledError)) {
      console.error(error)
    }
  }
}

export { searchQuery, startSearch }
export type { SearchResult }
