import { describe, expect, test } from "vitest"

import { createCache, memoryStore } from "@/server/cache.ts"
import type { Fetch } from "@/server/http.ts"
import { createNpmAdapter } from "@/server/registries/npm.ts"
import { handleSearch } from "@/server/search.ts"

import { fixtureFetch, statusFetch } from "../support/fixtures.ts"

const background: Promise<unknown>[] = []

function deps(fetcher: Fetch) {
  return {
    adapters: { npm: createNpmAdapter(fetcher) },
    cache: createCache({
      now: () => 0,
      onError: (error) => {
        throw error
      },
      store: memoryStore(),
      waitUntil: (promise) => {
        background.push(promise)
      },
    }),
  }
}

function url(query: string): URL {
  return new URL(`https://gerch.vkhr.dev/api/search?${query}`)
}

describe("search route", () => {
  test("returns normalized npm results with CDN cache headers", async () => {
    expect.hasAssertions()
    const { fetch } = await fixtureFetch("npm", ["search-zod"])
    const response = await handleSearch(url("registry=npm&q=zod"), deps(fetch))
    const body: unknown = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=600, stale-while-revalidate=604800"
    )
    expect(response.headers.get("x-gerch-cache")).toBe("miss")
    expect(body).toMatchObject({ query: "zod", registry: "npm" })
  })

  test("serves a normalized repeat query from the cache", async () => {
    expect.hasAssertions()
    const { fetch, requests } = await fixtureFetch("npm", ["search-zod"])
    const handler = deps(fetch)
    await handleSearch(url("registry=npm&q=zod"), handler)
    const repeat = await handleSearch(url("registry=npm&q=%20ZOD%20"), handler)
    expect(repeat.headers.get("x-gerch-cache")).toBe("hit")
    expect(requests).toHaveLength(1)
  })

  test.each(["registry=npm", "registry=npm&q=%20", "registry=pypi&q=x", "q=x"])(
    "rejects %s with 400",
    async (query) => {
      expect.hasAssertions()
      const response = await handleSearch(url(query), deps(statusFetch(500)))
      expect(response.status).toBe(400)
    }
  )

  test("answers 502 when the registry fails on a cold cache", async () => {
    expect.hasAssertions()
    const response = await handleSearch(
      url("registry=npm&q=zod"),
      deps(statusFetch(503))
    )
    expect(response.status).toBe(502)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toStrictEqual({
      error: "npm is unavailable",
    })
  })
})
