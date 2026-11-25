import { describe, expect, test } from "vitest"

import { handleHealth } from "@/server/health.ts"

const HOUR_MS = 3_600_000
const INGESTED = new Date("2026-11-25T12:00:00Z")

function state() {
  return {
    etag: '"d12a"',
    ingestedAt: INGESTED,
    packages: 152_276,
    release: "nixos-26.11pre1125864.2786a2a72088",
  }
}

describe("health route", () => {
  test("reports the nix index release and age, never cached", async () => {
    expect.hasAssertions()
    const response = await handleHealth({
      nixState: async () => state(),
      now: () => INGESTED.getTime() + 7 * HOUR_MS,
      refreshFailures: async () => [],
    })
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toStrictEqual({
      nix: {
        ageHours: 7,
        ingestedAt: "2026-11-25T12:00:00.000Z",
        packages: 152_276,
        release: "nixos-26.11pre1125864.2786a2a72088",
        stale: false,
      },
      ok: true,
      refreshFailures: [],
    })
  })

  test("marks an index older than a day as stale", async () => {
    expect.hasAssertions()
    const response = await handleHealth({
      nixState: async () => state(),
      now: () => INGESTED.getTime() + 24 * HOUR_MS,
      refreshFailures: async () => [],
    })
    await expect(response.json()).resolves.toMatchObject({
      nix: { stale: true },
      ok: true,
    })
  })

  test("stays up when the database is down", async () => {
    expect.hasAssertions()
    const response = await handleHealth({
      nixState: async () => {
        throw new Error("connection refused")
      },
      now: () => 0,
      refreshFailures: async () => {
        throw new Error("connection refused")
      },
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toStrictEqual({
      nix: { error: "the nix index can't be read" },
      ok: true,
      refreshFailures: { error: "the cache can't be read" },
    })
  })

  test("reports a missing index as null", async () => {
    expect.hasAssertions()
    const response = await handleHealth({
      nixState: async () => null,
      now: () => 0,
      refreshFailures: async () => [],
    })
    await expect(response.json()).resolves.toStrictEqual({
      nix: null,
      ok: true,
      refreshFailures: [],
    })
  })

  test("lists the last hour's failed refreshes per registry", async () => {
    expect.hasAssertions()
    const since: number[] = []
    const failedAt = 10 * HOUR_MS - 60_000
    const response = await handleHealth({
      nixState: async () => null,
      now: () => 10 * HOUR_MS,
      refreshFailures: async (from) => {
        since.push(from)
        return [{ at: failedAt, message: "upstream 503", registry: "crate" }]
      },
    })
    expect(since).toStrictEqual([9 * HOUR_MS])
    await expect(response.json()).resolves.toMatchObject({
      refreshFailures: [
        {
          at: new Date(failedAt).toISOString(),
          message: "upstream 503",
          registry: "crate",
        },
      ],
    })
  })
})
