import { isRegistry } from "@/shared/registry.ts"
import type { PackageSummary } from "@/shared/registry.ts"

import type { RegistryAdapter } from "./registries/types.ts"

import type { CachePolicy, CacheState } from "./cache.ts"
import { packageSummarySchema } from "./schema.ts"
import type { SearchDeps } from "./search.ts"

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000
const STALE_DAYS = 30
// The spec's cache table: an npm package is fresh for 1 h, stale up to 30 d.
const PACKAGE_POLICY: CachePolicy = {
  freshMs: HOUR_MS,
  staleMs: STALE_DAYS * DAY_MS,
}
const MS_PER_S = 1000
const PACKAGE_CDN_CACHE = `public, max-age=0, s-maxage=${PACKAGE_POLICY.freshMs / MS_PER_S}, stale-while-revalidate=${PACKAGE_POLICY.staleMs / MS_PER_S}`

type PackageOutcome =
  | { status: "found"; state: CacheState; summary: PackageSummary }
  | { status: "missing" }
  | { status: "failed"; message: string }

const summaryOrNull = packageSummarySchema.nullable()

function failed(message: string): PackageOutcome {
  return { message, status: "failed" }
}

function adapterFor(
  deps: SearchDeps,
  registry: string,
  name: string
): RegistryAdapter | string {
  if (!isRegistry(registry)) {
    return "registry must be one of npm, crate, nix"
  }
  if (name === "") {
    return "name must not be empty"
  }
  return deps.adapters[registry] ?? `${registry} is not available yet`
}

// One package through the shared cache. An unknown package is cached too, so
// repeated misses don't reach the registry.
async function runPackage(
  deps: SearchDeps,
  registry: string,
  rawName: string
): Promise<PackageOutcome> {
  const name = rawName.trim()
  const adapter = adapterFor(deps, registry, name)
  if (typeof adapter === "string") {
    return failed(adapter)
  }
  try {
    const found = await deps.cache.get({
      key: `package:${registry}:${name}`,
      load: async () => adapter.package(name),
      parse: (value) => summaryOrNull.parse(value),
      policy: PACKAGE_POLICY,
    })
    return found.value === null
      ? { status: "missing" }
      : { state: found.state, status: "found", summary: found.value }
  } catch {
    return failed(`${registry} is unavailable`)
  }
}

export { PACKAGE_CDN_CACHE, runPackage }
export type { PackageOutcome }
