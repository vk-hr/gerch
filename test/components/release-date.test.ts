import { QueryClient } from "@tanstack/react-query"
import { describe, expect, test } from "vitest"

import { cachedReleaseDate } from "@/components/package/release-date.ts"
import type { SearchResult } from "@/lib/search.ts"
import type { PackageSummary } from "@/shared/registry.ts"

const zod: PackageSummary = {
  description: null,
  downloads: null,
  homepage: null,
  install: "npm i zod",
  license: null,
  name: "zod",
  registry: "npm",
  releasedAt: "2026-11-20T10:00:00.000Z",
  repository: null,
  version: "4.6.7",
}

function found(results: PackageSummary[]): SearchResult {
  return { body: { query: "zod", registry: "npm", results }, ok: true }
}

describe("cached release date", () => {
  test("comes from a cached search result for the same package", () => {
    expect.hasAssertions()
    const client = new QueryClient()
    client.setQueryData(["search", "npm", "schema"], found([]))
    client.setQueryData(["search", "npm", "zod"], found([zod]))
    expect(cachedReleaseDate(client, "npm", "zod")).toBe(zod.releasedAt)
  })

  test("is null without a matching search result", () => {
    expect.hasAssertions()
    const client = new QueryClient()
    expect(cachedReleaseDate(client, "npm", "zod")).toBeNull()
    client.setQueryData(["search", "npm", "zod"], {
      message: "npm is unavailable",
      ok: false,
    } satisfies SearchResult)
    client.setQueryData(["search", "crate", "zod"], found([zod]))
    expect(cachedReleaseDate(client, "npm", "zod")).toBeNull()
    expect(cachedReleaseDate(client, "npm", "zod-x")).toBeNull()
  })
})
