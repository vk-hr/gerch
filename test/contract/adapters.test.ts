// The one contract every registry adapter passes against its recorded
// fixtures. Add a registry by adding a row.
import { describe, expect, test } from "vitest"

import { UpstreamError, USER_AGENT } from "@/server/http.ts"
import { createNpmAdapter } from "@/server/registries/npm.ts"
import { packageSummarySchema } from "@/server/schema.ts"

import { fixtureFetch, statusFetch } from "../support/fixtures.ts"

const UNAVAILABLE = 503

const adapters = [
  {
    cases: [
      { expectedFirst: "zod", fixture: "search-zod", query: "zod" },
      {
        expectedFirst: "@trpc/tanstack-react-query",
        fixture: "search-react-query",
        query: "react query",
      },
      {
        expectedFirst: "undici-types",
        fixture: "search-nonsense",
        query: "gerch-no-such-package-q7x2",
      },
    ],
    create: createNpmAdapter,
    install: (name: string) => `npm i ${name}`,
    registry: "npm",
  },
] as const

describe.each(adapters)(
  "$registry adapter contract",
  ({ cases, create, install, registry }) => {
    test.each(cases)(
      "$query returns valid summaries in registry order",
      async ({ expectedFirst, fixture, query }) => {
        expect.hasAssertions()
        const { fetch } = await fixtureFetch(registry, [fixture])
        const results = await create(fetch).search(query)
        expect(results[0]?.name).toBe(expectedFirst)
        expect(
          results.map((result) => packageSummarySchema.parse(result))
        ).toStrictEqual(results)
        expect(
          results.filter((result) => result.registry !== registry)
        ).toStrictEqual([])
        expect(
          results.filter((result) => result.install !== install(result.name))
        ).toStrictEqual([])
      }
    )

    test.each(cases)(
      "$query identifies gerch with its User-Agent",
      async ({ fixture, query }) => {
        expect.hasAssertions()
        const recorded = await fixtureFetch(registry, [fixture])
        await create(recorded.fetch).search(query)
        const agents = recorded.requests.map((request) => request.userAgent)
        expect(agents.length).toBeGreaterThan(0)
        expect(agents.filter((agent) => agent !== USER_AGENT)).toStrictEqual([])
      }
    )

    test("an upstream error rejects with UpstreamError", async () => {
      expect.hasAssertions()
      const adapter = create(statusFetch(UNAVAILABLE))
      await expect(adapter.search("anything")).rejects.toBeInstanceOf(
        UpstreamError
      )
    })
  }
)
