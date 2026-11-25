import { describe, expect, test } from "vitest"

import { createCache, memoryStore } from "@/server/cache.ts"
import type { Fetch } from "@/server/http.ts"
import { handlePackage, packageCdnCache } from "@/server/package.ts"
import { createNpmAdapter } from "@/server/registries/npm.ts"

import { fixtureFetch, statusFetch } from "../support/fixtures.ts"

function deps(fetcher: Fetch) {
  return {
    adapters: { npm: createNpmAdapter(fetcher) },
    cache: createCache({
      now: () => 0,
      onError: (error) => {
        throw error
      },
      store: memoryStore(),
      waitUntil: () => {
        // Nothing runs in the background in these tests.
      },
    }),
  }
}

describe("package route", () => {
  test("returns a package with its CDN cache headers", async () => {
    expect.hasAssertions()
    const { fetch } = await fixtureFetch("npm", [
      "package-zod-latest",
      "package-zod-downloads",
    ])
    const response = await handlePackage("npm", "zod", deps(fetch))
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe(packageCdnCache("npm"))
    expect(response.headers.get("x-gerch-cache")).toBe("miss")
    await expect(response.json()).resolves.toMatchObject({
      install: "npm i zod",
      name: "zod",
    })
  })

  test("answers 404 for a package the registry doesn't have", async () => {
    expect.hasAssertions()
    const { fetch } = await fixtureFetch("npm", [
      "package-nonsense-latest",
      "package-nonsense-downloads",
    ])
    const response = await handlePackage(
      "npm",
      "gerch-no-such-package-q7x2",
      deps(fetch)
    )
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe("no-store")
  })

  test.each([
    ["pypi", "requests", 400],
    ["npm", " ", 400],
    ["npm", "zod", 502],
  ])("answers %s/%p with %i", async (registry, name, status) => {
    expect.hasAssertions()
    const response = await handlePackage(registry, name, deps(statusFetch(503)))
    expect(response.status).toBe(status)
    expect(response.headers.get("cache-control")).toBe("no-store")
  })
})
