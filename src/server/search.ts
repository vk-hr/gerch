import { isRegistry } from "@/shared/registry.ts"
import type { Registry, SearchResponse } from "@/shared/registry.ts"

import type { Cache, CachePolicy } from "./cache.ts"
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

type Parsed =
  | { ok: true; registry: Registry; query: string; adapter: RegistryAdapter }
  | { ok: false; message: string }

function errorResponse(status: number, message: string): Response {
  return Response.json(
    { error: message },
    { headers: { "cache-control": "no-store" }, status }
  )
}

function parse(url: URL, deps: SearchDeps): Parsed {
  const registry = url.searchParams.get("registry") ?? ""
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase()
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

async function handleSearch(url: URL, deps: SearchDeps): Promise<Response> {
  const parsed = parse(url, deps)
  if (!parsed.ok) {
    return errorResponse(BAD_REQUEST, parsed.message)
  }
  const { adapter, query, registry } = parsed
  try {
    const found = await deps.cache.get({
      key: `search:${registry}:${query}`,
      load: async () => adapter.search(query),
      parse: (value) => packageSummariesSchema.parse(value),
      policy: SEARCH_POLICY,
    })
    const body: SearchResponse = { query, registry, results: found.value }
    return Response.json(body, {
      headers: { "cache-control": CDN_CACHE, "x-gerch-cache": found.state },
    })
  } catch {
    return errorResponse(BAD_GATEWAY, `${registry} is unavailable`)
  }
}

export { handleSearch }
export type { SearchDeps }
