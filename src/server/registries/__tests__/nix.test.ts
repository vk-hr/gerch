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
    const bool = (body.query as { bool: Record<string, unknown> }).bool

    expect(bool.filter).toEqual([{ term: { type: { value: "package" } } }])
    expect(body.sort).toEqual([{ _score: "desc" }])
    expect(body.size).toBe(25)
  })

  it("weights the exact attribute name highest", () => {
    const body = buildNixQuery("rust")
    const bool = (body.query as { bool: { should: Record<string, unknown>[] } })
      .bool
    const exact = bool.should.find(
      (clause) =>
        "term" in clause &&
        (clause.term as { package_attr_name?: { boost?: number } })
          .package_attr_name?.boost === 127
    )
    expect(exact).toBeDefined()
  })

  it("reads popularity from package_repology_repos", () => {
    const body = buildNixQuery("rust")
    const bool = (body.query as { bool: { should: Record<string, unknown>[] } })
      .bool
    const boosts = bool.should
      .filter((clause) => "rank_feature" in clause)
      .map((clause) => (clause.rank_feature as { boost?: number }).boost)
    expect(boosts).toEqual([328, 5])
  })

  it("glues multi-word queries into dashed attribute names", () => {
    const body = buildNixQuery("rust server")
    const bool = (body.query as { bool: { should: Record<string, unknown>[] } })
      .bool
    const exact = bool.should.find((clause) => "term" in clause) as {
      term: { package_attr_name: { value: string } }
    }
    expect(exact.term.package_attr_name.value).toBe("rust-server")
  })

  it("rescales by attribute name length", () => {
    const rescore = buildNixQuery("rust").rescore as {
      query: { rescore_query_weight: number }
    }
    expect(rescore.query.rescore_query_weight).toBe(30.3)
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
    const result = await searchNixHandler("php ast", "nixos-unstable", fetcher)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.records.length).toBeGreaterThan(0)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("caches results per channel and query", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify(nixSearchFixture), { status: 200 })
    )
    await searchNixHandler("php ast", "nixos-unstable", fetcher)
    await searchNixHandler("php ast", "nixos-unstable", fetcher)
    await searchNixHandler("php ast", "nixos-26.05", fetcher)

    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("degrades to unavailable on upstream errors", async () => {
    const failing = vi.fn(async () => new Response("boom", { status: 500 }))
    await expect(
      searchNixHandler("x", "nixos-unstable", failing)
    ).resolves.toEqual({ ok: false, reason: "unavailable" })

    const rejecting = vi.fn(async () => {
      throw new Error("network down")
    })
    await expect(
      searchNixHandler("x", "nixos-unstable", rejecting)
    ).resolves.toEqual({ ok: false, reason: "unavailable" })
  })

  it("returns no records for an empty query without calling upstream", async () => {
    const fetcher = vi.fn()
    await expect(
      searchNixHandler("   ", "nixos-unstable", fetcher)
    ).resolves.toEqual({ ok: true, records: [] })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
