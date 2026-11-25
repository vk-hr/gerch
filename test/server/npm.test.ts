import { describe, expect, test } from "vitest"

import type { Fetch } from "@/server/http.ts"
import { createNpmAdapter } from "@/server/registries/npm.ts"

import { fixtureFetch } from "../support/fixtures.ts"

describe("npm adapter", () => {
  test("maps the zod search result", async () => {
    expect.hasAssertions()
    const { fetch } = await fixtureFetch("npm", ["search-zod"])
    const [zod] = await createNpmAdapter(fetch).search("zod")
    expect(zod).toMatchObject({
      homepage: "https://zod.dev",
      install: "npm i zod",
      license: "MIT",
      name: "zod",
      registry: "npm",
      repository: "https://github.com/colinhacks/zod",
    })
    expect(zod?.downloads?.window).toBe("week")
    expect(zod?.description).toContain("TypeScript-first")
  })
})

const noDownloads = async () =>
  Response.json({ error: "not found" }, { status: 404 })

// Answers the registry and the downloads API from separate fakes.
function splitFetch(registry: Fetch, downloads: Fetch): Fetch {
  return async (input, init) =>
    input.startsWith("https://api.npmjs.org/")
      ? downloads(input, init)
      : registry(input, init)
}

describe("npm package", () => {
  test("maps the latest manifest and weekly downloads", async () => {
    expect.hasAssertions()
    const { fetch } = await fixtureFetch("npm", [
      "package-zod-latest",
      "package-zod-downloads",
    ])
    await expect(createNpmAdapter(fetch).package("zod")).resolves.toStrictEqual(
      {
        description:
          "TypeScript-first schema declaration and validation library with static type inference",
        downloads: { count: 468_631_616, window: "week" },
        homepage: "https://zod.dev",
        install: "npm i zod",
        license: "MIT",
        name: "zod",
        registry: "npm",
        // Only the full package document has release dates (D25).
        releasedAt: null,
        repository: "https://github.com/colinhacks/zod",
        version: "4.6.7",
      }
    )
  })

  test("encodes a scoped name and never asks for the full document", async () => {
    expect.hasAssertions()
    const { fetch, requests } = await fixtureFetch("npm", [
      "package-trpc-tanstack-react-query-latest",
      "package-trpc-tanstack-react-query-downloads",
    ])
    await createNpmAdapter(fetch).package("@trpc/tanstack-react-query")
    expect(new Set(requests.map((request) => request.url))).toStrictEqual(
      new Set([
        "https://api.npmjs.org/downloads/point/last-week/%40trpc%2Ftanstack-react-query",
        "https://registry.npmjs.org/%40trpc%2Ftanstack-react-query/latest",
      ])
    )
  })

  test("a package without download counts still loads", async () => {
    expect.hasAssertions()
    const { fetch: recorded } = await fixtureFetch("npm", [
      "package-zod-latest",
    ])
    const zod = await createNpmAdapter(
      splitFetch(recorded, noDownloads)
    ).package("zod")
    expect(zod?.downloads).toBeNull()
    expect(zod?.version).toBe("4.6.7")
  })

  test.each([
    [{ type: "ISC" }, "ISC"],
    ["", null],
    [undefined, null],
  ])("reads license %p as %p", async (license, expected) => {
    expect.hasAssertions()
    const fetcher = splitFetch(
      async () => Response.json({ license, name: "old", version: "1.0.0" }),
      async () => Response.json({ downloads: 1 })
    )
    const old = await createNpmAdapter(fetcher).package("old")
    expect(old?.license).toBe(expected)
    expect(old?.repository).toBeNull()
  })

  // One odd field drops that field, not the package.
  test("a malformed optional field doesn't fail the package", async () => {
    expect.hasAssertions()
    const fetcher = splitFetch(
      async () =>
        Response.json({
          description: 7,
          homepage: 5,
          license: ["MIT"],
          name: "odd",
          repository: { type: "git" },
          version: "1.0.0",
        }),
      async () => Response.json({ downloads: 1 })
    )
    const odd = await createNpmAdapter(fetcher).package("odd")
    expect(odd).toMatchObject({
      description: null,
      homepage: null,
      license: null,
      repository: null,
      version: "1.0.0",
    })
  })
})
