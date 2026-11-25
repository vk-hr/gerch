import { afterAll, afterEach, describe, expect, test } from "vitest"

import { nixRows } from "@/server/nix/dump.ts"
import {
  memoryNixIndex,
  nixIndexState,
  postgresNixIndex,
  replaceNixIndex,
} from "@/server/nix/store.ts"

import { nixDump } from "../support/nix.ts"
import { freshDb } from "../support/pglite.ts"
import type { TestDb } from "../support/pglite.ts"

const recordedRows = async () => nixRows(await nixDump())
const RELEASE = {
  etag: '"d12a"',
  release: "nixos-26.11pre1125864.2786a2a72088",
}

const database: { db?: TestDb } = {}

async function loaded() {
  database.db ??= await freshDb()
  await replaceNixIndex(database.db.db, await recordedRows(), RELEASE)
  return database.db.db
}

const attrs = (rows: readonly { attr: string }[]) => rows.map((row) => row.attr)

describe("nix index", () => {
  afterEach(async () => {
    await database.db?.empty()
  })

  afterAll(async () => {
    await database.db?.close()
  })

  describe("in Postgres", () => {
    test("ranks the exact attribute first, then top-level packages", async () => {
      expect.hasAssertions()
      const index = postgresNixIndex(await loaded())
      await expect(
        index.search("ripgrep", 20).then(attrs)
      ).resolves.toStrictEqual([
        "ripgrep",
        "ripgrep-all",
        "emacsPackages.ripgrep",
        "vimPlugins.blink-ripgrep-nvim",
        "emacsPackages.projectile-ripgrep",
      ])
    })

    test("finds a package by its program, by a prefix and by several words", async () => {
      expect.hasAssertions()
      const index = postgresNixIndex(await loaded())
      // The program of ripgrep is rg, and of ripgrep-all rga.
      await expect(index.search("rg", 20).then(attrs)).resolves.toStrictEqual([
        "ripgrep",
        "ripgrep-all",
      ])
      await expect(index.search("ripgr", 1).then(attrs)).resolves.toStrictEqual(
        ["ripgrep"]
      )
      await expect(
        index.search("python requests", 20).then(attrs)
      ).resolves.toStrictEqual([
        "python313Packages.requests",
        "python314Packages.requests",
      ])
    })

    test("a query with no words finds nothing", async () => {
      expect.hasAssertions()
      const index = postgresNixIndex(await loaded())
      await expect(index.search("--- !", 20)).resolves.toStrictEqual([])
    })

    test("loads one package by attribute path", async () => {
      expect.hasAssertions()
      const index = postgresNixIndex(await loaded())
      await expect(
        index.get("python313Packages.requests")
      ).resolves.toMatchObject({
        license: "Apache-2.0",
        version: "2.34.2",
      })
      await expect(index.get("python313Packages")).resolves.toBeNull()
    })

    test("a new dump replaces every row and records its release", async () => {
      expect.hasAssertions()
      const db = await loaded()
      const all = await recordedRows()
      const hello = all.filter((row) => row.attr === "hello")
      await replaceNixIndex(db, hello, { etag: '"e2"', release: "next" })
      await expect(
        postgresNixIndex(db).search("ripgrep", 20)
      ).resolves.toStrictEqual([])
      await expect(nixIndexState(db)).resolves.toMatchObject({
        etag: '"e2"',
        packages: 1,
        release: "next",
      })
    })
  })

  describe("in memory", () => {
    // The e2e server has no database and searches the recorded dump in memory;
    // it must rank exactly like Postgres.
    test.each([
      "ripgrep",
      "rg",
      "rip",
      "python requests",
      "requests",
      "zod",
      "hello",
      "web browser",
      "nodejs_22",
    ])("%p ranks the same as in Postgres", async (query) => {
      expect.hasAssertions()
      const fromPostgres = await postgresNixIndex(await loaded()).search(
        query,
        20
      )
      const fromMemory = await memoryNixIndex(await recordedRows()).search(
        query,
        20
      )
      expect(attrs(fromMemory)).toStrictEqual(attrs(fromPostgres))
      expect(fromPostgres.length).toBeGreaterThan(0)
    })

    // Postgres doesn't index digits such as "²" (review of #16).
    test.each(["x²", "²", "ripgrep²"])(
      "%p finds the same as in Postgres",
      async (query) => {
        expect.hasAssertions()
        const fromPostgres = await postgresNixIndex(await loaded()).search(
          query,
          20
        )
        const fromMemory = await memoryNixIndex(await recordedRows()).search(
          query,
          20
        )
        expect(attrs(fromMemory)).toStrictEqual(attrs(fromPostgres))
      }
    )
  })
})
