import nixSearchFixture from "@/server/registries/__tests__/fixtures/nix-search.json"
import {
  buildNixQuery,
  clearNixCache,
  mapNixSearch,
  searchNixHandler,
} from "@/server/registries/nix.server"
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
    const result = mapNixSearch(nixSearchFixture)
    expect(result.degraded).toBe(false)
    expect(result.records.length).toBeGreaterThan(0)

    const first = result.records[0]
    expect(first.registry).toBe("nix")
    expect(first.name).toBe("php84Extensions.ast")
    expect(first.version).toBe("1.1.3")
    expect(first.license).toBe("bsd3")
    expect(first.links.homepage).toBe("https://pecl.php.net/package/ast")
  })

  it("accepts nullable license fields", () => {
    const result = mapNixSearch({
      hits: {
        hits: [
          {
            _source: {
              package_attr_name: "firefox-bin",
              package_pversion: "140.0",
              package_description: "Firefox binary",
              package_homepage: null,
              package_license: [{ shortName: null, spdxId: null }],
            },
          },
        ],
      },
    })

    expect(result).toEqual({
      degraded: false,
      records: [
        {
          registry: "nix",
          name: "firefox-bin",
          version: "140.0",
          description: "Firefox binary",
          license: undefined,
          links: { homepage: undefined },
        },
      ],
    })
  })

  it("keeps valid records and marks partial schema drift degraded", () => {
    const result = mapNixSearch({
      hits: {
        hits: [
          nixSearchFixture.hits.hits[0],
          { _source: { package_pversion: "1.0" } },
        ],
      },
    })

    expect(result.degraded).toBe(true)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].name).toBe("php84Extensions.ast")
  })

  it("preserves all homepage and license values", () => {
    const result = mapNixSearch({
      hits: {
        hits: [
          {
            _source: {
              package_attr_name: "example",
              package_pversion: "1.0",
              package_description: null,
              package_homepage: [
                "https://example.com",
                "https://docs.example.com",
              ],
              package_license: [
                { shortName: "MIT", spdxId: "MIT" },
                { shortName: "Apache-2.0", spdxId: "Apache-2.0" },
              ],
            },
          },
        ],
      },
    })

    expect(result.records[0].homepages).toEqual([
      "https://example.com",
      "https://docs.example.com",
    ])
    expect(result.records[0].licenses).toEqual(["MIT", "Apache-2.0"])
  })

  it("marks malformed responses degraded instead of succeeding empty", () => {
    expect(mapNixSearch({ unexpected: true })).toEqual({
      records: [],
      degraded: true,
    })
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

  it("does not cache malformed upstream responses", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ unexpected: true }))
    )

    const first = await searchNixHandler(
      "firefox",
      "nixos-unstable",
      0,
      fetcher
    )
    const second = await searchNixHandler(
      "firefox",
      "nixos-unstable",
      0,
      fetcher
    )

    expect(first).toEqual({ ok: true, records: [], degraded: true })
    expect(second).toEqual(first)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("returns no records for an empty query without calling upstream", async () => {
    const fetcher = vi.fn()
    await expect(
      searchNixHandler("   ", "nixos-unstable", 0, fetcher)
    ).resolves.toEqual({ ok: true, records: [] })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
