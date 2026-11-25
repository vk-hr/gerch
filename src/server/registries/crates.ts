import { z } from "zod"

import { getJson, UpstreamError } from "@/server/http.ts"
import type { Fetch } from "@/server/http.ts"
import type { PackageSummary } from "@/shared/registry.ts"

import { httpUrl, repositoryUrl } from "./repository-url.ts"
import type { RegistryAdapter } from "./types.ts"

// Each request waits for a 1 req/s slot, so a page is kept short (D13).
const SEARCH_SIZE = 10
const NOT_FOUND = 404
const API = "https://crates.io/api/v1/crates"

// The fields gerch reads from a crate, in search results and on the package
// endpoint alike. Only the name must be valid; an odd optional field reads
// as missing.
const crateSchema = z.object({
  default_version: z.unknown().optional(),
  description: z.unknown().optional(),
  homepage: z.unknown().optional(),
  max_stable_version: z.unknown().optional(),
  name: z.string().min(1),
  recent_downloads: z.unknown().optional(),
  repository: z.unknown().optional(),
  updated_at: z.unknown().optional(),
})
const searchSchema = z.object({ crates: z.array(z.unknown()) })
// GET /crates/{name}?include=default_version,downloads: the crate plus only
// its default version (2.7 KB; every version is 441 KB for serde).
const packageSchema = z.object({
  crate: crateSchema,
  versions: z.array(z.unknown()),
})
const versionSchema = z.object({
  created_at: z.unknown().optional(),
  license: z.unknown().optional(),
  num: z.unknown().optional(),
})
const downloadsSchema = z.int().nonnegative()
const dateSchema = z.iso.datetime({ offset: true })

type Crate = z.infer<typeof crateSchema>
type Version = z.infer<typeof versionSchema>

// The crates.io naming rules: an ASCII letter first, then letters, digits, `-` or
// `_`, at most 64 characters.
const CRATE_NAME = /^[A-Za-z][\w-]{0,63}$/u

function isCrateName(name: string): boolean {
  return CRATE_NAME.test(name)
}

function textOf(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null
}

function dateOf(value: unknown): string | null {
  const parsed = dateSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

function downloadsOf(value: unknown): PackageSummary["downloads"] {
  const parsed = downloadsSchema.safeParse(value)
  return parsed.success ? { count: parsed.data, window: "90d" } : null
}

function summary(
  crate: Crate,
  version: Version | undefined,
  fallbackVersion: string
): PackageSummary {
  return {
    description: textOf(crate.description),
    downloads: downloadsOf(crate.recent_downloads),
    homepage: httpUrl(textOf(crate.homepage) ?? undefined),
    install: `cargo add ${crate.name}`,
    license: textOf(version?.license),
    name: crate.name,
    registry: "crate",
    releasedAt: dateOf(version?.created_at) ?? dateOf(crate.updated_at),
    repository: repositoryUrl(textOf(crate.repository) ?? undefined),
    version: textOf(version?.num) ?? fallbackVersion,
  }
}

// The newest stable version, or the default one for a crate with only
// pre-releases.
function versionOf(crate: Crate): string | null {
  return textOf(crate.max_stable_version) ?? textOf(crate.default_version)
}

// One malformed crate drops that crate, not the whole search.
function summaries(body: unknown): PackageSummary[] {
  return searchSchema.parse(body).crates.flatMap((entry) => {
    const parsed = crateSchema.safeParse(entry)
    const version = parsed.success ? versionOf(parsed.data) : null
    return parsed.success && version !== null
      ? [summary(parsed.data, undefined, version)]
      : []
  })
}

async function cratePackage(
  fetcher: Fetch,
  name: string
): Promise<PackageSummary | null> {
  try {
    const body = packageSchema.parse(
      await getJson(
        fetcher,
        `${API}/${encodeURIComponent(name)}?include=default_version,downloads`
      )
    )
    const version = versionSchema.safeParse(body.versions[0])
    const fallback = versionOf(body.crate)
    if (fallback === null) {
      return null
    }
    return summary(
      body.crate,
      version.success ? version.data : undefined,
      fallback
    )
  } catch (error) {
    if (error instanceof UpstreamError && error.status === NOT_FOUND) {
      return null
    }
    throw error
  }
}

// `fetcher` must already keep to crates.io's 1 req/s (rate-slot.ts).
function createCratesAdapter(fetcher: Fetch): RegistryAdapter {
  return {
    isPackageName: isCrateName,
    package: async (name) => cratePackage(fetcher, name),
    registry: "crate",
    search: async (query) =>
      summaries(
        await getJson(
          fetcher,
          `${API}?q=${encodeURIComponent(query)}&per_page=${SEARCH_SIZE}`
        )
      ),
  }
}

export { createCratesAdapter }
