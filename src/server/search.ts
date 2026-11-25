import { isRegistry } from "@/shared/registry.ts"
import type { Registry, SearchResponse } from "@/shared/registry.ts"

import type { Cache, CachePolicy, CacheState } from "./cache.ts"
import type { RegistryAdapter } from "./registries/types.ts"
import { packageSummariesSchema } from "./schema.ts"

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000
const FRESH_MINUTES = 10
const STALE_DAYS = 7
const SEARCH_POLICY: CachePolicy = {
  freshMs: FRESH_MINUTES * MINUTE_MS,
  staleMs: STALE_DAYS * DAY_MS,
}
const MS_PER_S = 1000
const CDN_CACHE = `public, max-age=0, s-maxage=${SEARCH_POLICY.freshMs / MS_PER_S}, stale-while-revalidate=${SEARCH_POLICY.staleMs / MS_PER_S}`
const BAD_REQUEST = 400
const BAD_GATEWAY = 502

interface SearchDeps {
  adapters: Partial<Record<Registry, RegistryAdapter>>
  cache: Cache
}

// "index": read from gerch's own index, without the shared cache.
type SearchOutcome =
  | { ok: true; state: CacheState | "index"; body: SearchResponse }
  | { ok: false; status: number; message: string }

type Parsed =
  | { ok: true; registry: Registry; query: string; adapter: RegistryAdapter }
  | { ok: false; message: string }

function parse(registry: string, rawQuery: string, deps: SearchDeps): Parsed {
  const query = rawQuery.trim().toLowerCase()
  if (!isRegistry(registry)) {
    return { message: "registry must be one of npm, crate, nix", ok: false }
  }
  const adapter = deps.adapters[registry]
  if (adapter === undefined) {
    return { message: `${registry} is not available yet`, ok: false }
  }
  if (query === "") {
    return { message: "q must not be empty", ok: false }
  }
  return { adapter, ok: true, query, registry }
}

async function searchThroughCache(
  deps: SearchDeps,
  {
    adapter,
    query,
    registry,
  }: { adapter: RegistryAdapter; query: string; registry: Registry }
): Promise<SearchOutcome> {
  if (adapter.localIndex === true) {
    const results = await adapter.search(query)
    return { body: { query, registry, results }, ok: true, state: "index" }
  }
  const found = await deps.cache.get({
    key: `search:${registry}:${query}`,
    load: async () => adapter.search(query),
    parse: (value) => packageSummariesSchema.parse(value),
    policy: SEARCH_POLICY,
  })
  return {
    body: { query, registry, results: found.value },
    ok: true,
    state: found.state,
  }
}

// One registry search through the shared cache. /api/search and the app's
// server function both call this, so they return the same results.
async function runSearch(
  deps: SearchDeps,
  registryInput: string,
  rawQuery: string
): Promise<SearchOutcome> {
  const parsed = parse(registryInput, rawQuery, deps)
  if (!parsed.ok) {
    return { message: parsed.message, ok: false, status: BAD_REQUEST }
  }
  try {
    return await searchThroughCache(deps, parsed)
  } catch {
    return {
      message: `${parsed.registry} is unavailable`,
      ok: false,
      status: BAD_GATEWAY,
    }
  }
}

async function handleSearch(url: URL, deps: SearchDeps): Promise<Response> {
  const outcome = await runSearch(
    deps,
    url.searchParams.get("registry") ?? "",
    url.searchParams.get("q") ?? ""
  )
  if (!outcome.ok) {
    return Response.json(
      { error: outcome.message },
      { headers: { "cache-control": "no-store" }, status: outcome.status }
    )
  }
  return Response.json(outcome.body, {
    headers: { "cache-control": CDN_CACHE, "x-gerch-cache": outcome.state },
  })
}

export { CDN_CACHE, handleSearch, runSearch }
export type { SearchDeps, SearchOutcome }
