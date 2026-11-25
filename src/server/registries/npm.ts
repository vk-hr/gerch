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
const licenseSchema = z.union([z.string(), z.object({ type: z.string() })])
const repositorySchema = z.union([z.string(), z.object({ url: z.string() })])
const manifestSchema = z.object({
  description: z.string().optional(),
  homepage: z.string().optional(),
  license: licenseSchema.optional(),
  name: z.string().min(1),
  repository: repositorySchema.optional(),
  version: z.string().min(1),
})
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

function licenseOf(license: Manifest["license"]): string | null {
  const id = typeof license === "object" ? license.type : license
  return id === undefined || id === "" ? null : id
}

function manifestSummary(
  manifest: Manifest,
  weekly: number | null
): PackageSummary {
  const { repository } = manifest
  return {
    description:
      manifest.description === "" ? null : (manifest.description ?? null),
    downloads: weekly === null ? null : { count: weekly, window: "week" },
    homepage: httpUrl(manifest.homepage),
    install: `npm i ${manifest.name}`,
    license: licenseOf(manifest.license),
    name: manifest.name,
    registry: "npm",
    releasedAt: null,
    repository: repositoryUrl(
      typeof repository === "object" ? repository.url : repository
    ),
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
