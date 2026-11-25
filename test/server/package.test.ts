import { afterAll, describe, expect, test } from "vitest"

import { createCache, memoryStore, postgresStore } from "@/server/cache.ts"
import type { CacheStore } from "@/server/cache.ts"
import type { Fetch } from "@/server/http.ts"
import { packageCdnCache, runPackage } from "@/server/package.ts"
import { createCratesAdapter } from "@/server/registries/crates.ts"
import { createNpmAdapter } from "@/server/registries/npm.ts"

import { fixtureFetch, statusFetch } from "../support/fixtures.ts"
import { freshDb } from "../support/pglite.ts"
import type { TestDb } from "../support/pglite.ts"

const background: Promise<unknown>[] = []
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

const database: { db?: TestDb } = {}

function deps(
  fetcher: Fetch,
  clock: { now: number },
  store: CacheStore = memoryStore()
) {
  return {
    adapters: {
      crate: createCratesAdapter(fetcher),
      npm: createNpmAdapter(fetcher),
    },
    cache: createCache({
      now: () => clock.now,
      onError: (error) => {
        throw error
      },
      store,
      waitUntil: (promise) => {
        background.push(promise)
      },
    }),
  }
}

const ZOD = ["package-zod-latest", "package-zod-downloads"]

describe("package lookup", () => {
  afterAll(async () => {
    await database.db?.close()
  })

  test("loads a package once and serves it fresh for an hour", async () => {
    expect.hasAssertions()
    const { fetch, requests } = await fixtureFetch("npm", ZOD)
    const clock = { now: 0 }
    const handler = deps(fetch, clock)
    const first = await runPackage(handler, "npm", "zod")
    expect(first).toMatchObject({ state: "miss", status: "found" })
    clock.now = HOUR_MS - 1
    await expect(runPackage(handler, "npm", "zod")).resolves.toMatchObject({
      state: "hit",
      summary: { name: "zod", version: "4.6.7" },
    })
    expect(requests).toHaveLength(2)
  })

  test("serves a crate fresh for 6 hours", async () => {
    expect.hasAssertions()
    const { fetch, requests } = await fixtureFetch("crate", ["package-serde"])
    const clock = { now: 0 }
    const handler = deps(fetch, clock)
    await runPackage(handler, "crate", "serde")
    clock.now = 6 * HOUR_MS - 1
    await expect(runPackage(handler, "crate", "serde")).resolves.toMatchObject({
      state: "hit",
      summary: { license: "MIT OR Apache-2.0", name: "serde" },
    })
    expect(requests).toHaveLength(1)
    clock.now = 6 * HOUR_MS
    await expect(runPackage(handler, "crate", "serde")).resolves.toMatchObject({
      state: "stale",
    })
  })

  test.each([
    ["npm", "s-maxage=3600,"],
    ["crate", "s-maxage=21600,"],
  ] as const)(
    "the CDN keeps a %s package for its fresh window",
    (registry, header) => {
      expect.hasAssertions()
      expect(packageCdnCache(registry)).toContain(header)
    }
  )

  test("serves a stale package for up to 30 days", async () => {
    expect.hasAssertions()
    const { fetch } = await fixtureFetch("npm", ZOD)
    const clock = { now: 0 }
    const handler = deps(fetch, clock)
    await runPackage(handler, "npm", "zod")
    clock.now = HOUR_MS + 30 * DAY_MS - 1
    await expect(runPackage(handler, "npm", "zod")).resolves.toMatchObject({
      state: "stale",
    })
  })

  test("reports an unknown package as missing", async () => {
    expect.hasAssertions()
    const { fetch } = await fixtureFetch("npm", [
      "package-nonsense-latest",
      "package-nonsense-downloads",
    ])
    const handler = deps(fetch, { now: 0 })
    const outcome = runPackage(handler, "npm", "gerch-no-such-package-q7x2")
    await expect(outcome).resolves.toStrictEqual({ status: "missing" })
  })

  // Production stores the cache in Postgres, where a value can't be null.
  test("reports an unknown package as missing from the Postgres cache", async () => {
    expect.hasAssertions()
    const { fetch } = await fixtureFetch("npm", [
      "package-nonsense-latest",
      "package-nonsense-downloads",
    ])
    database.db ??= await freshDb()
    const handler = deps(fetch, { now: 0 }, postgresStore(database.db.db))
    const name = "gerch-no-such-package-q7x2"
    await expect(runPackage(handler, "npm", name)).resolves.toStrictEqual({
      status: "missing",
    })
    await expect(runPackage(handler, "npm", name)).resolves.toStrictEqual({
      status: "missing",
    })
  })

  test.each([[".."], ["."], ["has space"], ["a".repeat(215)], ["@scope/"]])(
    "reports the invalid npm name %j as missing without asking npm",
    async (name) => {
      expect.hasAssertions()
      const handler = deps(statusFetch(500), { now: 0 })
      await expect(runPackage(handler, "npm", name)).resolves.toStrictEqual({
        status: "missing",
      })
    }
  )

  test("reports a failing registry", async () => {
    expect.hasAssertions()
    const handler = deps(statusFetch(503), { now: 0 })
    await expect(runPackage(handler, "npm", "zod")).resolves.toStrictEqual({
      message: "npm is unavailable",
      status: "failed",
    })
  })

  test.each([
    ["nix", "ripgrep", "nix is not available yet"],
    ["pypi", "requests", "registry must be one of npm, crate, nix"],
    ["npm", " ", "name must not be empty"],
  ])("rejects %s/%s", async (registry, name, message) => {
    expect.hasAssertions()
    const handler = deps(statusFetch(500), { now: 0 })
    await expect(runPackage(handler, registry, name)).resolves.toStrictEqual({
      message,
      status: "failed",
    })
  })
})
