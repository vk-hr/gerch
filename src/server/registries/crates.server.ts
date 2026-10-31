import type { PackageRecord } from "@/server/registries/record"

import { cachedReadme, sanitizeReadmeHtml } from "@/server/readme.server"
import {
  fetchCratesJson,
  ensureOk,
  fetchUpstream,
  type Fetcher,
} from "@/server/registries/upstream.server"
import { z } from "zod"

const CRATES_IO = "https://crates.io"
const CRATES_API = `${CRATES_IO}/api/v1/crates`
const DOCSRS = "https://docs.rs"

const cratesCrateSchema = z.object({
  id: z.string(),
  max_stable_version: z.string().nullish(),
  newest_version: z.string().nullish(),
  description: z.string().nullish(),
  recent_downloads: z.number().optional(),
  homepage: z.string().nullish(),
  documentation: z.string().nullish(),
  repository: z.string().nullish(),
})

const cratesSearchSchema = z
  .object({
    crates: z.array(cratesCrateSchema),
  })
  .transform(({ crates }): PackageRecord[] =>
    crates.map((crate) => ({
      registry: "crates",
      name: crate.id,
      version: crate.max_stable_version ?? crate.newest_version ?? undefined,
      description: crate.description ?? undefined,
      links: crateLinks(crate),
      downloads: crate.recent_downloads
        ? { recent: crate.recent_downloads }
        : undefined,
    }))
  )

const cratesDetailSchema = z
  .object({
    crate: cratesCrateSchema,
    versions: z
      .array(
        z.object({
          num: z.string(),
          license: z.string().nullish(),
          created_at: z.string().optional(),
        })
      )
      .optional(),
  })
  .transform(
    ({
      crate,
      versions,
    }): PackageRecord & {
      versions?: { num: string; created_at?: string }[]
    } => {
      const version =
        crate.max_stable_version ?? crate.newest_version ?? versions?.[0]?.num
      return {
        registry: "crates",
        name: crate.id,
        version: version ?? undefined,
        description: crate.description ?? undefined,
        license: licenseFor(version, versions),
        links: crateLinks(crate),
        downloads: crate.recent_downloads
          ? { recent: crate.recent_downloads }
          : undefined,
        versions: versions?.map((v) => ({
          num: v.num,
          created_at: v.created_at,
        })),
      }
    }
  )

export function mapCratesSearch(json: unknown): PackageRecord[] {
  const parsed = cratesSearchSchema.safeParse(json)
  return parsed.success ? parsed.data : []
}

export type CratesRecord = PackageRecord & {
  versions?: { num: string; created_at?: string }[]
}

export function mapCratesDetail(json: unknown): CratesRecord {
  const parsed = cratesDetailSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error(`unexpected crates.io response: ${parsed.error.message}`)
  }
  return parsed.data
}

type CratesCrate = z.infer<typeof cratesCrateSchema>

function crateLinks(crate: CratesCrate): PackageRecord["links"] {
  return {
    registry: `${CRATES_IO}/crates/${crate.id}`,
    homepage: crate.homepage ?? undefined,
    documentation: crate.documentation ?? `${DOCSRS}/${crate.id}`,
    repository: crate.repository ?? undefined,
  }
}

function licenseFor(
  version: string | null | undefined,
  versions: { num: string; license?: string | null }[] | undefined
): string | undefined {
  return (
    versions?.find((v) => v.num === version)?.license ??
    versions?.[0]?.license ??
    undefined
  )
}

export function extractDocsRsReadme(html: string): string | undefined {
  const open = '<details class="toggle top-doc"'
  const start = html.indexOf(open)
  if (start === -1) return undefined

  const summaryEnd = html.indexOf("</summary>", start)
  if (summaryEnd === -1) return undefined
  const from = summaryEnd + "</summary>".length

  let depth = 1
  let pos = from
  while (depth > 0) {
    const nextOpen = html.indexOf("<details", pos)
    const nextClose = html.indexOf("</details>", pos)
    if (nextClose === -1) return undefined
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      pos = nextOpen + "<details".length
    } else {
      depth -= 1
      if (depth === 0) return html.slice(from, nextClose)
      pos = nextClose + "</details>".length
    }
  }
  return undefined
}

export async function searchCratesHandler(
  q: string,
  offset = 0,
  fetcher: Fetcher = fetch
): Promise<PackageRecord[]> {
  const page = Math.floor(offset / 25) + 1
  const json = await fetchCratesJson(
    `${CRATES_API}?q=${encodeURIComponent(q)}&per_page=25&page=${page}`,
    {},
    fetcher
  )
  return mapCratesSearch(json)
}

export async function cratesReadmeHandler(
  name: string,
  fetcher: Fetcher = fetch
): Promise<string | undefined> {
  const response = await fetchUpstream(
    `${DOCSRS}/${encodeURIComponent(name)}/latest/${encodeURIComponent(name)}/`,
    {},
    fetcher
  )
  if (response.status === 404) return undefined
  await ensureOk(response, `docs.rs readme for ${name}`)
  return extractDocsRsReadme(await response.text())
}

export type CratesPackageDetail = {
  record: CratesRecord
  readmeHtml?: string
}

export async function cratesPackageHandler(
  name: string,
  fetcher: Fetcher = fetch
): Promise<CratesPackageDetail> {
  const [record, readmeHtml] = await Promise.all([
    fetchCratesJson(
      `${CRATES_API}/${encodeURIComponent(name)}`,
      {},
      fetcher
    ).then(mapCratesDetail),
    cratesReadmeHandler(name, fetcher).catch(() => undefined),
  ])
  return {
    record,
    readmeHtml: readmeHtml
      ? cachedReadme(`crates:${name}:${record.version ?? "latest"}`, () =>
          sanitizeReadmeHtml(
            readmeHtml,
            `${DOCSRS}/${encodeURIComponent(name)}/latest/${encodeURIComponent(name)}/`
          )
        )
      : undefined,
  }
}
