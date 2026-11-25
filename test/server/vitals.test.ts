import { afterAll, afterEach, describe, expect, test } from "vitest"

import { sql } from "drizzle-orm"

import { handleVitals, postgresVitals, pruneVitals } from "@/server/vitals.ts"
import type { StoredVital } from "@/server/vitals.ts"

import { freshDb } from "../support/pglite.ts"
import type { TestDb } from "../support/pglite.ts"

const LCP = {
  attribution: {
    elementRenderDelay: 12.5,
    lcpEntry: { large: "object" },
    target: "main>section>article>h3",
    timeToFirstByte: 80,
    url: "https://gerch.vkhr.dev/?q=private",
  },
  name: "LCP",
  navigationType: "navigate",
  rating: "good",
  route: "/",
  value: 412.3,
}

function post(body: unknown, size?: number): Request {
  const text = typeof body === "string" ? body : JSON.stringify(body)
  return new Request("https://gerch.vkhr.dev/api/vitals", {
    body: size === undefined ? text : text.padEnd(size, " "),
    method: "POST",
  })
}

function memory() {
  const stored: StoredVital[] = []
  return {
    store: {
      record: async (vital: StoredVital) => {
        stored.push(vital)
      },
    },
    stored,
  }
}

const database: { db?: TestDb } = {}

describe("vitals route", () => {
  afterEach(async () => {
    await database.db?.empty()
  })

  afterAll(async () => {
    await database.db?.close()
  })

  test("stores a sample with its release and only the allowed fields", async () => {
    expect.hasAssertions()
    const { store, stored } = memory()
    const response = await handleVitals(post(LCP), {
      release: "abc1234",
      store,
    })
    expect(response.status).toBe(204)
    expect(response.headers.get("cache-control")).toBe("no-store")
    // No URL (it can hold the search text) and no raw entries.
    expect(stored).toStrictEqual([
      {
        attribution: {
          elementRenderDelay: 12.5,
          target: "main>section>article>h3",
          timeToFirstByte: 80,
        },
        name: "LCP",
        navigationType: "navigate",
        rating: "good",
        release: "abc1234",
        route: "/",
        value: 412.3,
      },
    ])
  })

  test.each([
    ["an unknown metric", { ...LCP, name: "FID" }],
    ["a route that isn't a template", { ...LCP, route: "/?q=zod" }],
    ["a negative value", { ...LCP, value: -1 }],
    ["text that isn't JSON", "LCP=412"],
  ])("rejects %s", async (_case, body) => {
    expect.hasAssertions()
    const { store, stored } = memory()
    const response = await handleVitals(post(body), {
      release: "abc1234",
      store,
    })
    expect(response.status).toBe(400)
    expect(stored).toStrictEqual([])
  })

  test("rejects a body over 4 KB unread", async () => {
    expect.hasAssertions()
    const { store, stored } = memory()
    const response = await handleVitals(post(LCP, 4097), {
      release: "abc1234",
      store,
    })
    expect(response.status).toBe(413)
    expect(stored).toStrictEqual([])
  })

  test("accepts and drops samples when there is no database", async () => {
    expect.hasAssertions()
    const response = await handleVitals(post(LCP), {
      release: "local",
      store: null,
    })
    expect(response.status).toBe(204)
  })

  test("prunes samples older than 30 days", async () => {
    expect.hasAssertions()
    database.db ??= await freshDb()
    const { db } = database.db
    const store = postgresVitals(db)
    await handleVitals(post(LCP), { release: "old", store })
    await db.execute(
      sql`update vitals set created_at = now() - interval '31 days'`
    )
    await handleVitals(post(LCP), { release: "new", store })
    await expect(pruneVitals(db)).resolves.toBe(1)
    await expect(store.recent(5)).resolves.toMatchObject([{ release: "new" }])
  })

  test("writes a sample to Postgres", async () => {
    expect.hasAssertions()
    database.db ??= await freshDb()
    const store = postgresVitals(database.db.db)
    await handleVitals(post(LCP), { release: "abc1234", store })
    await expect(store.recent(5)).resolves.toMatchObject([
      { name: "LCP", release: "abc1234", route: "/", value: 412.3 },
    ])
  })
})
