import type { PackageRecord } from "@/server/registries/record"

import {
  ensureOk,
  fetchJson,
  fetchUpstream,
  type Fetcher,
} from "@/server/registries/upstream"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

const NPM_REGISTRY = "https://registry.npmjs.org"
const UNPKG = "https://unpkg.com"

export function cleanGitUrl(url?: string): string | undefined {
  return url?.replace(/^git\+/, "").replace(/\.git$/, "")
}

const npmSearchSchema = z
  .object({
    objects: z.array(
      z.object({
        package: z.object({
          name: z.string(),
          version: z.string().optional(),
          description: z.string().optional(),
          license: z.string().optional(),
          links: z
            .object({
              npm: z.string().optional(),
              homepage: z.string().optional(),
              repository: z.string().optional(),
              bugs: z.string().optional(),
            })
            .optional(),
        }),
        downloads: z.object({ monthly: z.number().optional() }).optional(),
      })
    ),
  })
  .transform(({ objects }): PackageRecord[] =>
    objects.map((hit) => ({
      registry: "npm",
      name: hit.package.name,
      version: hit.package.version,
      description: hit.package.description,
      license: hit.package.license,
      links: {
        registry: hit.package.links?.npm,
        homepage: hit.package.links?.homepage,
        repository: cleanGitUrl(hit.package.links?.repository),
        issues: hit.package.links?.bugs,
      },
      downloads: hit.downloads?.monthly
        ? { monthly: hit.downloads.monthly }
        : undefined,
    }))
  )

export function mapNpmSearch(json: unknown): PackageRecord[] {
  const parsed = npmSearchSchema.safeParse(json)
  return parsed.success ? parsed.data : []
}

export type NpmPackageDetail = {
  record: PackageRecord
  readmeMarkdown?: string
}

const npmDocSchema = z
  .object({
    name: z.string(),
    "dist-tags": z.object({ latest: z.string().optional() }).optional(),
    description: z.string().optional(),
    license: z
      .union([
        z.string(),
        z.object({ type: z.string() }).transform((value) => value.type),
      ])
      .optional(),
    homepage: z.string().optional(),
    repository: z
      .union([
        z.string(),
        z
          .object({ url: z.string().optional() })
          .transform((value) => value.url),
      ])
      .optional(),
    bugs: z.object({ url: z.string().optional() }).optional(),
    readme: z.string().optional(),
  })
  .transform((doc): NpmPackageDetail => ({
    record: {
      registry: "npm",
      name: doc.name,
      version: doc["dist-tags"]?.latest,
      description: doc.description,
      license: doc.license,
      links: {
        registry: `${NPM_REGISTRY}/package/${doc.name}`,
        homepage: doc.homepage,
        repository: cleanGitUrl(doc.repository),
        issues: doc.bugs?.url,
      },
    },
    readmeMarkdown: doc.readme || undefined,
  }))

export function mapNpmDoc(json: unknown): NpmPackageDetail {
  const parsed = npmDocSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error(`unexpected npm registry document: ${parsed.error.message}`)
  }
  return parsed.data
}

export async function searchNpmHandler(
  q: string,
  fetcher: Fetcher = fetch
): Promise<PackageRecord[]> {
  const json = await fetchJson(
    `${NPM_REGISTRY}/-/v1/search?text=${encodeURIComponent(q)}&size=25`,
    {},
    fetcher
  )
  return mapNpmSearch(json)
}

export async function npmDetailHandler(
  name: string,
  fetcher: Fetcher = fetch
): Promise<NpmPackageDetail> {
  const json = await fetchJson(
    `${NPM_REGISTRY}/${encodeURIComponent(name)}`,
    {},
    fetcher
  )
  return mapNpmDoc(json)
}

export async function npmReadmeHandler(
  name: string,
  version: string,
  fetcher: Fetcher = fetch
): Promise<string | undefined> {
  const response = await fetchUpstream(
    `${UNPKG}/${encodeURIComponent(name)}@${encodeURIComponent(version)}/README.md?raw`,
    {},
    fetcher
  )
  if (response.status === 404) return undefined
  await ensureOk(response, `unpkg readme for ${name}@${version}`)
  return response.text()
}

export async function npmPackageHandler(
  name: string,
  fetcher: Fetcher = fetch
): Promise<NpmPackageDetail> {
  const detail = await npmDetailHandler(name, fetcher)
  if (detail.readmeMarkdown || !detail.record.version) return detail
  const readme = await npmReadmeHandler(name, detail.record.version, fetcher)
  return readme ? { ...detail, readmeMarkdown: readme } : detail
}

export const searchNpm = createServerFn({ method: "GET" })
  .validator((q: unknown) => {
    if (typeof q !== "string" || q.length === 0) {
      throw new Error("q must be a non-empty string")
    }
    return q
  })
  .handler(async ({ data }) => searchNpmHandler(data))

export const npmPackage = createServerFn({ method: "GET" })
  .validator((name: unknown) => {
    if (typeof name !== "string" || name.length === 0) {
      throw new Error("name must be a non-empty string")
    }
    return name
  })
  .handler(async ({ data }) => npmPackageHandler(data))
