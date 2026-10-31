import type { PackageRecord } from "@/server/registries/record"
import type { Fetcher } from "@/server/registries/upstream.server"

import { env } from "@/env.server"
import { type NixChannel } from "@/lib/nix-channel"
import { LRUCache } from "lru-cache"
import { z } from "zod"

const SCHEMA_VERSION = "52"
const DEFAULT_CHANNEL = "nixos-unstable"
const SEARCH_SIZE = 25
const CACHE_TTL_MS = 10 * 60 * 1000
const TIMEOUT_MS = 5000

export type NixSearchResult =
  | { ok: true; records: PackageRecord[]; degraded?: boolean }
  | { ok: false; reason: "unavailable" }

type Clause = Record<string, unknown>

type NixQueryBody = {
  from: number
  size: number
  sort: { _score: string }[]
  query: {
    bool: {
      filter: Clause[]
      must: Clause[]
      should: Clause[]
    }
  }
  rescore: {
    window_size: number
    query: {
      rescore_query: unknown
      rescore_query_weight: number
    }
  }
}

const whenTyped = (words: string[], derived: string[]): string[] =>
  words.some((word) => word.length > 0) ? derived : []

const multiWordWhole = (words: string[]): string[] =>
  words.length > 1 ? [words.join(" ")] : []

const glued =
  (separator: string) =>
  (words: string[]): string[] => [words.join(separator)]

const dotted = (words: string[]): string[] =>
  whenTyped(words, [words.join(".")])

const lastWord = (words: string[]): string[] =>
  whenTyped(words, words.length > 0 ? [words[words.length - 1]] : [])

const allButLast = (words: string[]): string[] =>
  whenTyped(words, words.length > 1 ? [words.slice(0, -1).join(" ")] : [])

const dashUnderscoreVariants = (word: string): string[] => [
  word.replaceAll("_", "-"),
  word.replaceAll("-", "_"),
  word,
]

const perWord = (
  spec: { variants: boolean; surround: boolean },
  words: string[]
): string[] => {
  const expanded = spec.variants ? words.flatMap(dashUnderscoreVariants) : words
  const unique = [...new Set(expanded)]
  return spec.surround ? unique.map((word) => `*${word}*`) : unique
}

const keywordClauses = (
  spec: { kind: string; field: string; boost?: number; ci: boolean },
  texts: string[]
): Clause[] =>
  texts.map((text) => ({
    [spec.kind]: {
      [spec.field]: {
        value: text,
        ...(spec.boost !== undefined ? { boost: spec.boost } : {}),
        ...(spec.ci ? { case_insensitive: true } : {}),
      },
    },
  }))

const multiMatchClauses = (
  spec: {
    type: string
    extra?: Record<string, unknown>
    fields: string[]
    boost?: number
  },
  texts: string[]
): Clause[] =>
  texts.map((text) => ({
    multi_match: {
      type: spec.type,
      query: text,
      ...spec.extra,
      fields: spec.fields,
      ...(spec.boost !== undefined ? { boost: spec.boost } : {}),
    },
  }))

const constantScore = (boost: number, clauses: Clause[]): Clause[] =>
  clauses.map((clause) => ({
    constant_score: { filter: clause, boost },
  }))

const rankFeature = (
  field: string,
  boost: number | undefined,
  fn: [string, Record<string, unknown>],
  name?: string
): Clause => ({
  rank_feature: {
    field,
    ...(boost !== undefined ? { boost } : {}),
    [fn[0]]: fn[1],
    ...(name ? { _name: name } : {}),
  },
})

const logFn = (scalingFactor: number): [string, Record<string, unknown>] => [
  "log",
  { scaling_factor: scalingFactor },
]

const saturationFn = (pivot: number): [string, Record<string, unknown>] => [
  "saturation",
  { pivot },
]

const sigmoidFn = (
  pivot: number,
  exponent: number
): [string, Record<string, unknown>] => ["sigmoid", { pivot, exponent }]

const disMax = (tieBreaker: number, queries: Clause[]): Clause => ({
  dis_max: { tie_breaker: tieBreaker, queries },
})

export function buildNixQuery(q: string, from = 0): NixQueryBody {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)

  const descriptionPhrase = constantScore(
    110,
    multiMatchClauses(
      {
        type: "phrase",
        fields: ["package_description^7.42", "package_longDescription^1"],
      },
      multiWordWhole(words)
    )
  )

  const fuzzyLastWord = multiMatchClauses(
    {
      type: "best_fields",
      extra: {
        fuzziness: "1",
        prefix_length: 1,
        minimum_should_match: "20%",
      },
      fields: [
        "package_attr_name^0.378",
        "package_programs^0.441",
        "package_mainProgram^0.413",
        "package_pname^0.30000000000000004",
      ],
    },
    lastWord(words)
  )

  const attrNameSubstrings = keywordClauses(
    { kind: "wildcard", field: "package_attr_name", ci: true },
    perWord({ variants: true, surround: true }, words)
  )

  const exactName = keywordClauses(
    { kind: "term", field: "package_attr_name", boost: 127, ci: false },
    glued("-")(words)
  )

  const namePrefix = keywordClauses(
    { kind: "prefix", field: "package_attr_name", boost: 16.4, ci: true },
    glued("")(words)
  )

  const pnamePrefix = keywordClauses(
    { kind: "prefix", field: "package_pname", boost: 10.1, ci: true },
    glued("")(words)
  )

  const leadingWords = multiMatchClauses(
    {
      type: "cross_fields",
      extra: { analyzer: "keyword" },
      fields: [
        "package_pname.edge^3.52",
        "package_description^1.17",
        "package_programs^117",
      ],
    },
    allButLast(words)
  )

  const popularity = [
    rankFeature("package_repology_repos", 328, logFn(5140)),
    rankFeature(
      "package_repology_repos",
      5,
      saturationFn(13.5),
      "popularity_package_repology_repos"
    ),
  ]

  const depCountAndText = [
    {
      bool: {
        must: [
          // oxlint-disable-next-line oxc(approx-constant)
          rankFeature("package_dep_count", undefined, sigmoidFn(7580, 0.434)),
        ],
        should: multiMatchClauses(
          {
            type: "best_fields",
            extra: { analyzer: "lowercase" },
            fields: [
              "package_longDescription.edge^12",
              "package_attr_set^2.97",
              "package_attr_name.edge^0.307",
            ],
            boost: 0.128,
          },
          perWord({ variants: false, surround: false }, words)
        ),
        boost: 0.364,
      },
    },
  ]

  const programPath = keywordClauses(
    { kind: "wildcard", field: "package_programs", boost: 12.8, ci: true },
    dotted(words)
  )

  return {
    from,
    size: SEARCH_SIZE,
    sort: [{ _score: "desc" }],
    query: {
      bool: {
        filter: [{ term: { type: { value: "package" } } }],
        must: [
          disMax(0.387, [
            ...descriptionPhrase,
            ...fuzzyLastWord,
            ...attrNameSubstrings,
          ]),
        ],
        should: [
          ...exactName,
          ...namePrefix,
          ...leadingWords,
          ...pnamePrefix,
          ...popularity,
          ...depCountAndText,
          ...programPath,
        ],
      },
    },
    rescore: {
      window_size: 100,
      query: {
        rescore_query: {
          function_score: {
            script_score: {
              script: {
                source:
                  "doc['package_attr_name'].size() == 0 ? 0 : 1.0 / doc['package_attr_name'].value.length()",
              },
            },
          },
        },
        rescore_query_weight: 30.3,
      },
    },
  }
}

const nixSourceSchema = z.object({
  package_attr_name: z.string(),
  package_pversion: z.string(),
  package_description: z.string().nullish(),
  package_homepage: z.array(z.string()).nullish(),
  package_license: z
    .array(
      z.object({
        shortName: z.string().nullish(),
        spdxId: z.string().nullish(),
      })
    )
    .nullish(),
})

const nixHitSchema = z.object({ _source: nixSourceSchema })

const nixResponseSchema = z.object({
  hits: z.object({ hits: z.array(z.unknown()) }),
})

export function mapNixSearch(json: unknown): {
  records: PackageRecord[]
  degraded: boolean
} {
  const parsed = nixResponseSchema.safeParse(json)
  if (!parsed.success) return { records: [], degraded: true }

  const records: PackageRecord[] = []
  let degraded = false
  for (const hit of parsed.data.hits.hits) {
    const valid = nixHitSchema.safeParse(hit)
    if (!valid.success) {
      degraded = true
      continue
    }
    const source = valid.data._source
    const licenses = source.package_license
      ?.map((license) => license.shortName ?? license.spdxId)
      .filter((license): license is string => Boolean(license))
    records.push({
      registry: "nix",
      name: source.package_attr_name,
      version: source.package_pversion,
      description: source.package_description ?? undefined,
      license:
        source.package_license?.[0]?.shortName ??
        source.package_license?.[0]?.spdxId ??
        undefined,
      licenses: licenses?.length ? licenses : undefined,
      homepages: source.package_homepage ?? undefined,
      links: { homepage: source.package_homepage?.[0] },
    })
  }
  return { records, degraded }
}

const cache = new LRUCache<string, PackageRecord[]>({
  max: 200,
  ttl: CACHE_TTL_MS,
  perf: { now: () => Date.now() },
})

export function clearNixCache(): void {
  cache.clear()
}

export async function searchNixHandler(
  q: string,
  channel: NixChannel = DEFAULT_CHANNEL,
  offset = 0,
  fetcher: Fetcher = fetch
): Promise<NixSearchResult> {
  if (!q.trim()) return { ok: true, records: [] }
  if (!env.SERVER_NIX_ES_USERNAME || !env.SERVER_NIX_ES_PASSWORD) {
    return { ok: false, reason: "unavailable" }
  }

  const key = `${channel}:${q}:${offset}`
  const hit = cache.get(key)
  if (hit) {
    return { ok: true, records: hit }
  }

  const index = `latest-${SCHEMA_VERSION}-${channel}`
  const response = await fetcher(`${env.SERVER_NIX_ES_URL}/${index}/_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${btoa(
        `${env.SERVER_NIX_ES_USERNAME}:${env.SERVER_NIX_ES_PASSWORD}`
      )}`,
    },
    body: JSON.stringify(buildNixQuery(q, offset)),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => undefined)

  if (!response?.ok) return { ok: false, reason: "unavailable" }

  const result = mapNixSearch(await response.json().catch(() => undefined))
  if (!result.degraded) cache.set(key, result.records)
  return { ok: true, records: result.records, degraded: result.degraded }
}
