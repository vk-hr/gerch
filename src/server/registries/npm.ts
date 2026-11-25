import { z } from "zod"

import { getJson, UpstreamError } from "@/server/http.ts"
import type { Fetch } from "@/server/http.ts"
import type { PackageSummary } from "@/shared/registry.ts"

import { httpUrl, repositoryUrl } from "./repository-url.ts"
import type { RegistryAdapter } from "./types.ts"

const SEARCH_SIZE = 20
const NOT_FOUND = 404

// The fields gerch reads from GET /-/v1/search; everything else is ignored.
const linksSchema = z.object({
  homepage: z.string().optional(),
  repository: z.string().optional(),
})
const packageSchema = z.object({
  date: z.iso.datetime({ offset: true }).optional(),
  description: z.string().optional(),
  license: z.string().optional(),
  links: linksSchema.optional(),
  name: z.string().min(1),
  version: z.string().min(1),
})
const objectSchema = z.object({
  downloads: z.object({ weekly: z.int().nonnegative() }).optional(),
  package: packageSchema,
})
const searchSchema = z.object({ objects: z.array(z.unknown()) })

type SearchObject = z.infer<typeof objectSchema>

// The fields gerch reads from GET /<name>/latest, one version's manifest
// (~4 KB). The full package document is megabytes (D25).
// Only name and version must be valid; a malformed optional field reads as
// missing, so one odd field never fails a package that exists.
const licenseSchema = z.union([z.string(), z.object({ type: z.string() })])
const repositorySchema = z.union([z.string(), z.object({ url: z.string() })])
const manifestSchema = z.object({
  description: z.unknown().optional(),
  homepage: z.unknown().optional(),
  license: z.unknown().optional(),
  name: z.string().min(1),
  repository: z.unknown().optional(),
  version: z.string().min(1),
})

// The npm registry's limits: at most 214 characters, no spaces or extra slashes, and
// no leading dot or underscore (which also rules out "." and "..").
const NPM_NAME_MAX = 214
const NPM_NAME = /^(?:@[^\s/]+\/)?[^\s./_][^\s/]*$/u

function isNpmName(name: string): boolean {
  return name.length <= NPM_NAME_MAX && NPM_NAME.test(name)
}
const pointSchema = z.object({ downloads: z.int().nonnegative() })

type Manifest = z.infer<typeof manifestSchema>

function toSummary({ downloads, package: pkg }: SearchObject): PackageSummary {
  return {
    description: pkg.description ?? null,
    downloads:
      downloads === undefined
        ? null
        : { count: downloads.weekly, window: "week" },
    homepage: httpUrl(pkg.links?.homepage),
    install: `npm i ${pkg.name}`,
    license: pkg.license === "" ? null : (pkg.license ?? null),
    name: pkg.name,
    registry: "npm",
    releasedAt: pkg.date ?? null,
    repository: repositoryUrl(pkg.links?.repository),
    version: pkg.version,
  }
}

// One malformed entry drops that entry, not the whole search.
function summaries(body: unknown): PackageSummary[] {
  return searchSchema.parse(body).objects.flatMap((object) => {
    const parsed = objectSchema.safeParse(object)
    return parsed.success ? [toSummary(parsed.data)] : []
  })
}

function textOf(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null
}

function licenseOf(value: unknown): string | null {
  const parsed = licenseSchema.safeParse(value)
  if (!parsed.success) {
    return null
  }
  return textOf(
    typeof parsed.data === "object" ? parsed.data.type : parsed.data
  )
}

function repositoryOf(value: unknown): string | null {
  const parsed = repositorySchema.safeParse(value)
  if (!parsed.success) {
    return null
  }
  return repositoryUrl(
    typeof parsed.data === "object" ? parsed.data.url : parsed.data
  )
}

function manifestSummary(
  manifest: Manifest,
  weekly: number | null
): PackageSummary {
  return {
    description: textOf(manifest.description),
    downloads: weekly === null ? null : { count: weekly, window: "week" },
    homepage: httpUrl(textOf(manifest.homepage) ?? undefined),
    install: `npm i ${manifest.name}`,
    license: licenseOf(manifest.license),
    name: manifest.name,
    registry: "npm",
    releasedAt: null,
    repository: repositoryOf(manifest.repository),
    version: manifest.version,
  }
}

// A 404 means the package (or its download count) doesn't exist.
async function getJsonOrNull(fetcher: Fetch, url: string): Promise<unknown> {
  try {
    return await getJson(fetcher, url)
  } catch (error) {
    if (error instanceof UpstreamError && error.status === NOT_FOUND) {
      return null
    }
    throw error
  }
}

async function npmPackage(
  fetcher: Fetch,
  name: string
): Promise<PackageSummary | null> {
  const encoded = encodeURIComponent(name)
  const [manifest, point] = await Promise.all([
    getJsonOrNull(fetcher, `https://registry.npmjs.org/${encoded}/latest`),
    getJsonOrNull(
      fetcher,
      `https://api.npmjs.org/downloads/point/last-week/${encoded}`
    ),
  ])
  if (manifest === null) {
    return null
  }
  return manifestSummary(
    manifestSchema.parse(manifest),
    point === null ? null : pointSchema.parse(point).downloads
  )
}

function createNpmAdapter(fetcher: Fetch): RegistryAdapter {
  return {
    isPackageName: isNpmName,
    package: async (name) => npmPackage(fetcher, name),
    registry: "npm",
    search: async (query) =>
      summaries(
        await getJson(
          fetcher,
          `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${SEARCH_SIZE}`
        )
      ),
  }
}

export { createNpmAdapter }
