import { afterAll, afterEach, describe, expect, test } from "vitest"

import type { Fetch } from "@/server/http.ts"
import { USER_AGENT } from "@/server/http.ts"
import { CHANNEL_URL } from "@/server/nix/dump.ts"
import { releaseOf, runNixIngest } from "@/server/nix/ingest.ts"
import { nixIndexState, postgresNixIndex } from "@/server/nix/store.ts"

import { nixDump } from "../support/nix.ts"
import { freshDb } from "../support/pglite.ts"
import type { TestDb } from "../support/pglite.ts"

const database: { db?: TestDb } = {}

async function testDb() {
  database.db ??= await freshDb()
  return database.db.db
}

// The channel as of one release: HEAD answers with its ETag, GET with the
// recorded dump. Records each request's method, URL and User-Agent.
function channel(etag: string) {
  const requests: string[] = []
  const fetcher: Fetch = async (input, init) => {
    const agent = new Headers(init?.headers).get("user-agent")
    requests.push(`${init?.method ?? "GET"} ${input} ${agent === USER_AGENT}`)
    return init?.method === "HEAD"
      ? new Response(null, { headers: { etag } })
      : Response.json(await nixDump(), { headers: { etag } })
  }
  return { fetcher, requests }
}

// A new release whose dump is `dump`.
function newRelease(dump: unknown): Fetch {
  return async (_input, init) =>
    Response.json(init?.method === "HEAD" ? null : dump, {
      headers: { etag: '"two"' },
    })
}

// A new release whose download fails.
const failingDownload: Fetch = async (_input, init) =>
  init?.method === "HEAD"
    ? new Response(null, { headers: { etag: '"two"' } })
    : new Response("unavailable", { status: 503 })

describe("nix ingest", () => {
  afterEach(async () => {
    await database.db?.empty()
  })

  afterAll(async () => {
    await database.db?.close()
  })

  test("loads a new dump into the index", async () => {
    expect.hasAssertions()
    const db = await testDb()
    const { fetcher, requests } = channel('"one"')
    await expect(runNixIngest(db, fetcher)).resolves.toStrictEqual({
      packages: 18,
      status: "replaced",
    })
    await expect(postgresNixIndex(db).get("ripgrep")).resolves.toMatchObject({
      version: "15.2.0",
    })
    await expect(nixIndexState(db)).resolves.toMatchObject({ etag: '"one"' })
    expect(requests).toStrictEqual([
      `HEAD ${CHANNEL_URL} true`,
      `GET ${CHANNEL_URL} true`,
    ])
  })

  test("skips the download while the ETag is unchanged", async () => {
    expect.hasAssertions()
    const db = await testDb()
    await runNixIngest(db, channel('"one"').fetcher)
    const again = channel('"one"')
    await expect(runNixIngest(db, again.fetcher)).resolves.toStrictEqual({
      status: "unchanged",
    })
    expect(again.requests).toStrictEqual([`HEAD ${CHANNEL_URL} true`])
  })

  test("a failed download leaves the index as it was", async () => {
    expect.hasAssertions()
    const db = await testDb()
    await runNixIngest(db, channel('"one"').fetcher)
    await expect(runNixIngest(db, failingDownload)).rejects.toThrow("503")
    await expect(nixIndexState(db)).resolves.toMatchObject({
      etag: '"one"',
      packages: 18,
    })
  })

  // A changed dump format would drop most entries; replacing the index with
  // the rest would empty search until the next release (review of #16).
  test.each([
    ["an empty dump", { packages: {}, version: 2 }],
    [
      "a dump with under half the packages",
      { packages: { hello: { version: "1" } }, version: 2 },
    ],
  ])("refuses %s and keeps the index", async (_case, dump) => {
    expect.hasAssertions()
    const db = await testDb()
    await runNixIngest(db, channel('"one"').fetcher)
    await expect(runNixIngest(db, newRelease(dump))).rejects.toThrow("refusing")
    await expect(nixIndexState(db)).resolves.toMatchObject({
      etag: '"one"',
      packages: 18,
    })
  })

  test.each([
    [
      "https://releases.nixos.org/nixos/unstable/nixos-26.11pre1125864.2786a2a72088/packages.json.br",
      "nixos-26.11pre1125864.2786a2a72088",
    ],
    [CHANNEL_URL, null],
    ["", null],
  ])("the release of %p is %p", (url, release) => {
    expect.hasAssertions()
    expect(releaseOf(url)).toBe(release)
  })
})
