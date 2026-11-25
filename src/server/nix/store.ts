// The nix index: search and lookup over the channel dump's packages. In
// production it lives in Postgres (nix_packages); the e2e server, which has
// no database, keeps the recorded dump in memory and ranks it the same way.
import { asc, desc, eq, sql } from "drizzle-orm"

import type { Database } from "@/server/db/index.ts"
import { nixIndex, nixPackages } from "@/server/db/schema.ts"
import { getJson } from "@/server/http.ts"
import type { Fetch } from "@/server/http.ts"

import { CHANNEL_URL, nixRows } from "./dump.ts"
import type { NixRow } from "./dump.ts"

interface NixIndex {
  search: (query: string, limit: number) => Promise<NixRow[]>
  get: (attr: string) => Promise<NixRow | null>
}

interface NixRelease {
  etag: string | null
  release: string | null
}

interface NixIndexState extends NixRelease {
  packages: number
  ingestedAt: Date
}

const CHANNEL = "nixos-unstable"
const INSERT_BATCH = 2000

// The words of a text, as Postgres indexes them: runs of letters and digits,
// lower-cased.
function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "")
}

// Every query word must start some word of the package; the last word may
// still be half typed, so all of them match as prefixes.
function prefixQuery(words: readonly string[]): string {
  return words.map((word) => `${word}:*`).join(" & ")
}

const SELECTED = {
  attr: nixPackages.attr,
  description: nixPackages.description,
  homepage: nixPackages.homepage,
  license: nixPackages.license,
  mainProgram: nixPackages.mainProgram,
  pname: nixPackages.pname,
  version: nixPackages.version,
}

// Ranking, in order: the exact attribute path; every word in the names
// rather than only the description; top-level packages before package sets;
// an exact package or program name; a path that starts with the query;
// shorter paths; then alphabetical. Measured on the full dump in D30.
function postgresNixIndex(db: Database): NixIndex {
  return {
    get: async (attr) => {
      const [row] = await db
        .select(SELECTED)
        .from(nixPackages)
        .where(eq(nixPackages.attr, attr))
      return row ?? null
    },
    search: async (query, limit) => {
      const words = wordsOf(query)
      if (words.length === 0) {
        return []
      }
      const text = query.trim().toLowerCase()
      const match = sql`to_tsquery('simple', ${prefixQuery(words)})`
      return db
        .select(SELECTED)
        .from(nixPackages)
        .where(sql`${nixPackages.textWords} @@ ${match}`)
        .orderBy(
          desc(sql`lower(${nixPackages.attr}) = ${text}`),
          desc(sql`${nixPackages.nameWords} @@ ${match}`),
          desc(sql`position('.' in ${nixPackages.attr}) = 0`),
          desc(
            sql`lower(${nixPackages.pname}) = ${text} or lower(coalesce(${nixPackages.mainProgram}, '')) = ${text}`
          ),
          desc(sql`starts_with(lower(${nixPackages.attr}), ${text})`),
          asc(sql`length(${nixPackages.attr})`),
          asc(sql`${nixPackages.attr} collate "C"`)
        )
        .limit(limit)
    },
  }
}

interface MemoryEntry {
  row: NixRow
  nameWords: string[]
  textWords: string[]
}

const matchesAll = (query: readonly string[], words: readonly string[]) =>
  query.every((part) => words.some((word) => word.startsWith(part)))

// The same ranking as postgresNixIndex, as a list of sort keys.
function rankKeys(
  { nameWords, row }: MemoryEntry,
  query: readonly string[],
  text: string
) {
  return [
    row.attr.toLowerCase() === text ? 0 : 1,
    matchesAll(query, nameWords) ? 0 : 1,
    row.attr.includes(".") ? 1 : 0,
    row.pname.toLowerCase() === text ||
    (row.mainProgram ?? "").toLowerCase() === text
      ? 0
      : 1,
    row.attr.toLowerCase().startsWith(text) ? 0 : 1,
    row.attr.length,
  ]
}

function compareEntries(query: readonly string[], text: string) {
  return (left: MemoryEntry, right: MemoryEntry): number => {
    const leftKeys = rankKeys(left, query, text)
    const rightKeys = rankKeys(right, query, text)
    const differs = leftKeys.findIndex((key, at) => key !== rightKeys[at])
    if (differs !== -1) {
      return (leftKeys[differs] ?? 0) - (rightKeys[differs] ?? 0)
    }
    // Code-point order, like Postgres' "C" collation.
    if (left.row.attr === right.row.attr) {
      return 0
    }
    return left.row.attr < right.row.attr ? -1 : 1
  }
}

function memoryNixIndex(rows: readonly NixRow[]): NixIndex {
  const entries = rows.map((row) => {
    const names = `${row.attr} ${row.pname} ${row.mainProgram ?? ""}`
    return {
      nameWords: wordsOf(names),
      row,
      textWords: wordsOf(`${names} ${row.description ?? ""}`),
    }
  })
  return {
    get: async (attr) =>
      entries.find((entry) => entry.row.attr === attr)?.row ?? null,
    search: async (query, limit) => {
      const words = wordsOf(query)
      if (words.length === 0) {
        return []
      }
      return entries
        .filter((entry) => matchesAll(words, entry.textWords))
        .toSorted(compareEntries(words, query.trim().toLowerCase()))
        .slice(0, limit)
        .map((entry) => entry.row)
    },
  }
}

// The recorded dump, read through `fetcher` on first use: how the e2e server
// (GERCH_REPLAY_DIR) and the contract test search nixpkgs without Postgres.
async function loadIndex(fetcher: Fetch): Promise<NixIndex> {
  return memoryNixIndex(nixRows(await getJson(fetcher, CHANNEL_URL)))
}

function fetchedNixIndex(fetcher: Fetch): NixIndex {
  const loaded: { index?: Promise<NixIndex> } = {}
  const index = async () => {
    loaded.index ??= loadIndex(fetcher)
    try {
      return await loaded.index
    } catch (error) {
      // A failed load is retried by the next request.
      delete loaded.index
      throw error
    }
  }
  return {
    get: async (attr) => {
      const ready = await index()
      return ready.get(attr)
    },
    search: async (query, limit) => {
      const ready = await index()
      return ready.search(query, limit)
    },
  }
}

// Swaps in a new dump in one transaction: searches see the old index until
// the new one is complete.
async function replaceNixIndex(
  db: Database,
  rows: readonly NixRow[],
  release: NixRelease
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(nixPackages)
    const batches = Array.from(
      { length: Math.ceil(rows.length / INSERT_BATCH) },
      (_batch, at) => rows.slice(at * INSERT_BATCH, (at + 1) * INSERT_BATCH)
    )
    await batches.reduce(async (previous, batch) => {
      await previous
      await tx.insert(nixPackages).values([...batch])
    }, Promise.resolve())
    const state = { ...release, ingestedAt: new Date(), packages: rows.length }
    await tx
      .insert(nixIndex)
      .values({ channel: CHANNEL, ...state })
      .onConflictDoUpdate({ set: state, target: nixIndex.channel })
  })
}

async function nixIndexState(db: Database): Promise<NixIndexState | null> {
  const [state] = await db
    .select({
      etag: nixIndex.etag,
      ingestedAt: nixIndex.ingestedAt,
      packages: nixIndex.packages,
      release: nixIndex.release,
    })
    .from(nixIndex)
    .where(eq(nixIndex.channel, CHANNEL))
  return state ?? null
}

export {
  fetchedNixIndex,
  memoryNixIndex,
  nixIndexState,
  postgresNixIndex,
  replaceNixIndex,
}
export type { NixIndex, NixIndexState, NixRelease }
