// The one contract every registry adapter passes against its recorded
// fixtures. Add a registry by adding a row.
import { describe, expect, test } from "vitest"

import { UpstreamError, USER_AGENT } from "@/server/http.ts"
import type { Fetch } from "@/server/http.ts"
import { fetchedNixIndex } from "@/server/nix/store.ts"
import { createCratesAdapter } from "@/server/registries/crates.ts"
import { createNixAdapter } from "@/server/registries/nix.ts"
import { createNpmAdapter } from "@/server/registries/npm.ts"
import type { RegistryAdapter } from "@/server/registries/types.ts"
import { packageSummarySchema } from "@/server/schema.ts"
import type { Registry } from "@/shared/registry.ts"

import { fixtureFetch, statusFetch } from "../support/fixtures.ts"

const UNAVAILABLE = 503

interface AdapterContract {
  // Searches against recorded fixtures; expectedFirst is undefined when the
  // registry finds nothing.
  cases: readonly {
    expectedFirst: string | undefined
    fixture: string
    query: string
  }[]
  create: (fetcher: Fetch) => RegistryAdapter
  install: (name: string) => string
  missing: { fixtures: readonly string[]; name: string }
  packages: readonly { fixtures: readonly string[]; name: string }[]
  registry: Registry
}

const adapters: readonly AdapterContract[] = [
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
    missing: {
      fixtures: ["package-nonsense-latest", "package-nonsense-downloads"],
      name: "gerch-no-such-package-q7x2",
    },
    packages: [
      {
        fixtures: ["package-zod-latest", "package-zod-downloads"],
        name: "zod",
      },
      {
        fixtures: [
          "package-trpc-tanstack-react-query-latest",
          "package-trpc-tanstack-react-query-downloads",
        ],
        name: "@trpc/tanstack-react-query",
      },
    ],
    registry: "npm",
  },
  {
    cases: [
      { expectedFirst: "serde", fixture: "search-serde", query: "serde" },
      { expectedFirst: "zod", fixture: "search-zod", query: "zod" },
      {
        expectedFirst: undefined,
        fixture: "search-nonsense",
        query: "gerch-no-such-package-q7x2",
      },
    ],
    create: createCratesAdapter,
    install: (name: string) => `cargo add ${name}`,
    missing: {
      fixtures: ["package-nonsense"],
      name: "gerch-no-such-package-q7x2",
    },
    packages: [
      { fixtures: ["package-serde"], name: "serde" },
      { fixtures: ["package-serde_json"], name: "serde_json" },
    ],
    registry: "crate",
  },
  {
    cases: [
      { expectedFirst: "ripgrep", fixture: "channel-dump", query: "ripgrep" },
      { expectedFirst: "zod", fixture: "channel-dump", query: "zod" },
      {
        expectedFirst: undefined,
        fixture: "channel-dump",
        query: "gerch-no-such-package-q7x2",
      },
    ],
    // The recorded dump through the in-memory index, as the e2e server runs
    // it. test/server/nix-index.test.ts holds the Postgres index to the same
    // ranking.
    create: (fetcher: Fetch) => createNixAdapter(fetchedNixIndex(fetcher)),
    install: (name: string) => `nix-shell -p ${name}`,
    missing: {
      fixtures: ["channel-dump"],
      name: "gerch-no-such-package-q7x2",
    },
    packages: [
      { fixtures: ["channel-dump"], name: "ripgrep" },
      { fixtures: ["channel-dump"], name: "python313Packages.requests" },
    ],
    registry: "nix",
  },
]

describe.each(adapters)(
  "$registry adapter contract",
  ({ cases, create, install, missing, packages, registry }) => {
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

    test.each(packages)(
      "package $name returns a valid summary",
      async ({ fixtures, name }) => {
        expect.hasAssertions()
        const recorded = await fixtureFetch(registry, fixtures)
        const summary = await create(recorded.fetch).package(name)
        const parsed: unknown = packageSummarySchema.parse(summary)
        expect(parsed).toStrictEqual(summary)
        expect(summary).toMatchObject({
          install: install(name),
          name,
          registry,
        })
        expect(
          recorded.requests.filter(
            (request) => request.userAgent !== USER_AGENT
          )
        ).toStrictEqual([])
      }
    )

    test("an unknown package returns null", async () => {
      expect.hasAssertions()
      const { fetch } = await fixtureFetch(registry, missing.fixtures)
      await expect(create(fetch).package(missing.name)).resolves.toBeNull()
    })

    test("an upstream error rejects with UpstreamError", async () => {
      expect.hasAssertions()
      const adapter = create(statusFetch(UNAVAILABLE))
      await expect(adapter.search("anything")).rejects.toBeInstanceOf(
        UpstreamError
      )
      await expect(adapter.package("anything")).rejects.toBeInstanceOf(
        UpstreamError
      )
    })
  }
)
