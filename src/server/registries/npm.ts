import { z } from "zod"

import { getJson } from "@/server/http.ts"
import type { Fetch } from "@/server/http.ts"
import type { PackageSummary } from "@/shared/registry.ts"

import { httpUrl, repositoryUrl } from "./repository-url.ts"
import type { RegistryAdapter } from "./types.ts"

const SEARCH_SIZE = 20

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

function createNpmAdapter(fetcher: Fetch): RegistryAdapter {
  return {
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
