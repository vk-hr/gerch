import { dehydrate, QueryClient } from "@tanstack/react-query"
import { describe, expect, test } from "vitest"

import {
  PERSIST_MAX_AGE_MS,
  shouldPersistQuery,
} from "@/client/query-persister.ts"

const found = {
  body: { query: "zod", registry: "npm", results: [] },
  ok: true,
} as const

describe("the persisted query cache", () => {
  test("keeps successful searches only", () => {
    expect.hasAssertions()
    const client = new QueryClient()
    client.setQueryData(["search", "npm", "zod"], found)
    client.setQueryData(["search", "npm", "down"], {
      message: "npm is unavailable",
      ok: false,
    })
    client.setQueryData(["package", "npm", "zod"], { ok: true })
    const persisted = dehydrate(client, {
      shouldDehydrateQuery: shouldPersistQuery,
    })
    expect(persisted.queries.map((query) => query.queryKey)).toStrictEqual([
      ["search", "npm", "zod"],
    ])
  })

  test("keeps searches for the spec's seven-day stale window", () => {
    expect.hasAssertions()
    expect(PERSIST_MAX_AGE_MS).toBe(7 * 86_400_000)
  })
})
