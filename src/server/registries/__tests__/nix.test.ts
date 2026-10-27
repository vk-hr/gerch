import nixSearchFixture from "@/server/registries/__tests__/fixtures/nix-search.json"
import {
  buildNixQuery,
  clearNixCache,
  mapNixSearch,
  searchNixHandler,
} from "@/server/registries/nix"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  clearNixCache()
})

describe("buildNixQuery", () => {
  it("filters to packages and sorts by score", () => {
    const body = buildNixQuery("rust")

    expect(body.query.bool.filter).toEqual([
      { term: { type: { value: "package" } } },
    ])
    expect(body.sort).toEqual([{ _score: "desc" }])
    expect(body.size).toBe(25)
  })

  it("passes the offset as the ES from parameter", () => {
    expect(buildNixQuery("rust", 50).from).toBe(50)
  })

  it("weights the exact attribute name highest", () => {
    expect(buildNixQuery("rust").query.bool.should).toContainEqual({
      term: { package_attr_name: { value: "rust", boost: 127 } },
    })
  })

  it("reads popularity from package_repology_repos", () => {
    const should = buildNixQuery("rust").query.bool.should
    expect(should).toContainEqual({
      rank_feature: {
        field: "package_repology_repos",
        boost: 328,
        log: { scaling_factor: 5140 },
      },
    })
    expect(should).toContainEqual({
      rank_feature: {
        field: "package_repology_repos",
        boost: 5,
        saturation: { pivot: 13.5 },
        _name: "popularity_package_repology_repos",
      },
    })
  })

  it("glues multi-word queries into dashed attribute names", () => {
    expect(buildNixQuery("rust server").query.bool.should).toContainEqual({
      term: { package_attr_name: { value: "rust-server", boost: 127 } },
    })
  })

  it("rescales by attribute name length", () => {
    expect(buildNixQuery("rust").rescore.query.rescore_query_weight).toBe(30.3)
  })
})

describe("mapNixSearch", () => {
  it("maps ES hits to package records", () => {
    const records = mapNixSearch(nixSearchFixture)
    expect(records.length).toBeGreaterThan(0)

    const first = records[0]
    expect(first.registry).toBe("nix")
    expect(first.name).toBe("php84Extensions.ast")
    expect(first.version).toBe("1.1.3")
    expect(first.license).toBe("bsd3")
    expect(first.links.homepage).toBe("https://pecl.php.net/package/ast")
  })

  it("returns an empty list for malformed responses", () => {
    expect(mapNixSearch({ unexpected: true })).toEqual([])
  })
})

describe("searchNixHandler", () => {
  it("returns records on success", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify(nixSearchFixture), { status: 200 })
    )
    const result = await searchNixHandler(
      "php ast",
      "nixos-unstable",
      0,
      fetcher
    )

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.records.length).toBeGreaterThan(0)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("caches results per channel and query", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify(nixSearchFixture), { status: 200 })
    )
    await searchNixHandler("php ast", "nixos-unstable", 0, fetcher)
    await searchNixHandler("php ast", "nixos-unstable", 0, fetcher)
    await searchNixHandler("php ast", "nixos-26.05", 0, fetcher)

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("degrades to unavailable on upstream errors", async () => {
    const failing = vi.fn(async () => new Response("boom", { status: 500 }))
    await expect(
      searchNixHandler("x", "nixos-unstable", 0, failing)
    ).resolves.toEqual({ ok: false, reason: "unavailable" })

    const rejecting = vi.fn(async () => {
      throw new Error("network down")
    })
    await expect(
      searchNixHandler("x", "nixos-unstable", 0, rejecting)
    ).resolves.toEqual({ ok: false, reason: "unavailable" })
  })

  it("returns no records for an empty query without calling upstream", async () => {
    const fetcher = vi.fn()
    await expect(
      searchNixHandler("   ", "nixos-unstable", 0, fetcher)
    ).resolves.toEqual({ ok: true, records: [] })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
