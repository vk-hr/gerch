import { describe, expect, test } from "vitest"

import { createCache, memoryStore } from "@/server/cache.ts"
import type { Fetch } from "@/server/http.ts"
import { runPackage } from "@/server/package.ts"
import { createNpmAdapter } from "@/server/registries/npm.ts"

import { fixtureFetch, statusFetch } from "../support/fixtures.ts"

const background: Promise<unknown>[] = []
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

function deps(fetcher: Fetch, clock: { now: number }) {
  return {
    adapters: { npm: createNpmAdapter(fetcher) },
    cache: createCache({
      now: () => clock.now,
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

const ZOD = ["package-zod-latest", "package-zod-downloads"]

describe("package lookup", () => {
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

  test("reports a failing registry", async () => {
    expect.hasAssertions()
    const handler = deps(statusFetch(503), { now: 0 })
    await expect(runPackage(handler, "npm", "zod")).resolves.toStrictEqual({
      message: "npm is unavailable",
      status: "failed",
    })
  })

  test.each([
    ["crate", "serde", "crate is not available yet"],
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
