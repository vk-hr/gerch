import npmDocFixture from "@/server/registries/__tests__/fixtures/npm-doc.json"
import npmSearchFixture from "@/server/registries/__tests__/fixtures/npm-search.json"
import {
  cleanGitUrl,
  mapNpmDoc,
  mapNpmSearch,
  npmPackageHandler,
  searchNpmHandler,
} from "@/server/registries/npm.server"
import {
  clearUpstreamCache,
  UpstreamError,
} from "@/server/registries/upstream.server"
import { afterEach, describe, expect, it } from "vitest"

afterEach(() => {
  clearUpstreamCache()
})

const notFoundFetcher = async () => new Response("not found", { status: 404 })

describe("searchNpmHandler", () => {
  it("passes the offset to the npm search endpoint", async () => {
    const requested: string[] = []
    const fetcher = async (url: string) => {
      requested.push(url)
      return new Response(JSON.stringify({ objects: [] }), { status: 200 })
    }
    await searchNpmHandler("react", 50, fetcher)
    expect(requested[0]).toContain("from=50")
  })
})

describe("mapNpmSearch", () => {
  it("maps search hits to package records", () => {
    const records = mapNpmSearch(npmSearchFixture)
    expect(records).toHaveLength(5)

    const react = records[0]
    expect(react.registry).toBe("npm")
    expect(react.name).toBe("react")
    expect(react.version).toBe("19.3.1")
    expect(react.license).toBe("MIT")
    expect(react.links.registry).toBe("https://www.npmjs.com/package/react")
    expect(react.links.homepage).toBe("https://react.dev/")
    expect(react.links.repository).toBe("https://github.com/react/react")
    expect(react.downloads?.monthly).toBeGreaterThan(0)
  })

  it("tolerates hits with missing optional fields", () => {
    const records = mapNpmSearch({
      objects: [{ package: { name: "bare" } }],
    })
    expect(records[0]).toMatchObject({
      registry: "npm",
      name: "bare",
      links: {},
    })
    expect(records[0].version).toBeUndefined()
    expect(records[0].downloads).toBeUndefined()
  })
})

describe("mapNpmDoc", () => {
  it("maps the registry document to a detail", () => {
    const detail = mapNpmDoc(npmDocFixture)
    expect(detail.record.name).toBe("react")
    expect(detail.record.version).toBe("19.3.1")
    expect(detail.record.license).toBe("MIT")
    expect(detail.record.links.homepage).toBe("https://react.dev/")
    expect(detail.record.links.repository).toBe(
      "https://github.com/react/react"
    )
    expect(detail.record.links.issues).toBe(
      "https://github.com/react/react/issues"
    )
  })

  it("leaves readmeMarkdown undefined when the registry readme is empty", () => {
    const detail = mapNpmDoc(npmDocFixture)
    expect(detail.readmeMarkdown).toBeUndefined()
  })
})

describe("cleanGitUrl", () => {
  it("strips the git+ prefix and .git suffix", () => {
    expect(cleanGitUrl("git+https://github.com/owner/repo.git")).toBe(
      "https://github.com/owner/repo"
    )
    expect(cleanGitUrl("https://gitlab.com/owner/repo")).toBe(
      "https://gitlab.com/owner/repo"
    )
    expect(cleanGitUrl(undefined)).toBeUndefined()
  })
})

describe("npmPackageHandler", () => {
  it("falls back to the unpkg readme when the registry readme is empty", async () => {
    const requested: string[] = []
    const fetcher = async (url: string) => {
      requested.push(url)
      if (url.includes("unpkg.com")) {
        return new Response("# React\n", { status: 200 })
      }
      return new Response(JSON.stringify(npmDocFixture), { status: 200 })
    }

    const detail = await npmPackageHandler("react", fetcher)

    expect(detail.readmeMarkdown).toBe("# React\n")
    expect(requested).toHaveLength(2)
    expect(requested[0]).toContain("registry.npmjs.org/react")
    expect(requested[1]).toContain("unpkg.com/react@19.3.1/README.md")
  })

  it("skips the unpkg request when the registry readme is present", async () => {
    const doc = { ...npmDocFixture, readme: "# from the registry" }
    const requested: string[] = []
    const fetcher = async (url: string) => {
      requested.push(url)
      return new Response(JSON.stringify(doc), { status: 200 })
    }

    const detail = await npmPackageHandler("react", fetcher)

    expect(detail.readmeMarkdown).toBe("# from the registry")
    expect(requested).toHaveLength(1)
  })

  it("throws UpstreamError when the package does not exist", async () => {
    await expect(
      npmPackageHandler("definitely-not-real-xyz", notFoundFetcher)
    ).rejects.toBeInstanceOf(UpstreamError)
  })
})
