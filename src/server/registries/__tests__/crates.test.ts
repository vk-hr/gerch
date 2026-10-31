import { clearReadmeCache } from "@/server/readme.server"
import cratesDetailFixture from "@/server/registries/__tests__/fixtures/crates-detail.json"
import cratesSearchFixture from "@/server/registries/__tests__/fixtures/crates-search.json"
import {
  cratesPackageHandler,
  extractDocsRsReadme,
  mapCratesDetail,
  mapCratesSearch,
  searchCratesHandler,
} from "@/server/registries/crates.server"
import { clearUpstreamCache } from "@/server/registries/upstream.server"
import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it } from "vitest"

const docsrsReadmeFixture = readFileSync(
  new URL("./fixtures/docsrs-readme.raw", import.meta.url),
  "utf8"
)

afterEach(() => {
  clearUpstreamCache()
  clearReadmeCache()
})

describe("searchCratesHandler", () => {
  it("maps the offset to a crates.io page number", async () => {
    const requested: string[] = []
    const fetcher = async (url: string) => {
      requested.push(url)
      return new Response(JSON.stringify({ crates: [] }), { status: 200 })
    }
    await searchCratesHandler("serde", 50, fetcher)
    expect(requested[0]).toContain("page=3")
  })
})

describe("mapCratesSearch", () => {
  it("maps crates to package records without license (detail-only)", () => {
    const records = mapCratesSearch(cratesSearchFixture)
    expect(records.length).toBeGreaterThan(0)

    const react = records[0]
    expect(react.registry).toBe("crates")
    expect(react.name).toBe("react")
    expect(react.version).toBe("0.1.0")
    expect(react.license).toBeUndefined()
    expect(react.links.registry).toBe("https://crates.io/crates/react")
    expect(react.links.repository).toBe(
      "https://github.com/camjackson/react-rs"
    )
    expect(react.links.documentation).toBe("https://docs.rs/react")
    expect(react.downloads?.recent).toBe(12)
  })
})

describe("mapCratesDetail", () => {
  it("takes the license from the matching version entry", () => {
    const record = mapCratesDetail(cratesDetailFixture)
    expect(record.name).toBe("react")
    expect(record.version).toBe("0.1.0")
    expect(record.license).toBe("GPL-3.0")
  })
})

describe("extractDocsRsReadme", () => {
  it("extracts the readme html from a docs.rs crate page", () => {
    const readme = extractDocsRsReadme(docsrsReadmeFixture)
    expect(readme).toContain("Serde is a framework")
    expect(readme).not.toContain("<summary>")
  })

  it("returns undefined when the page has no top-doc block", () => {
    expect(
      extractDocsRsReadme("<html><body>no docs here</body></html>")
    ).toBeUndefined()
  })
})

describe("cratesPackageHandler", () => {
  it("combines the crates.io detail with the docs.rs readme", async () => {
    const requested: string[] = []
    const fetcher = async (url: string) => {
      requested.push(url)
      if (url.includes("crates.io")) {
        return new Response(JSON.stringify(cratesDetailFixture), {
          status: 200,
        })
      }
      return new Response(docsrsReadmeFixture, { status: 200 })
    }

    const detail = await cratesPackageHandler("react", fetcher)

    expect(detail.record.license).toBe("GPL-3.0")
    expect(detail.readmeHtml).toContain("Serde is a framework")
    expect(requested.some((url) => url.includes("crates.io/api"))).toBe(true)
    expect(requested.some((url) => url.includes("docs.rs"))).toBe(true)
  })

  it("rebases relative docs.rs links and images", async () => {
    const html = `<details class="toggle top-doc"><summary>Readme</summary><p><a href="../guide">Guide</a><img src="diagram.png"></p></details>`
    const detail = await cratesPackageHandler("react", async (url) => {
      if (url.includes("crates.io")) {
        return new Response(JSON.stringify(cratesDetailFixture), {
          status: 200,
        })
      }
      return new Response(html, { status: 200 })
    })

    expect(detail.readmeHtml).toContain(
      'href="https://docs.rs/react/latest/guide"'
    )
    expect(detail.readmeHtml).toContain(
      'src="https://docs.rs/react/latest/react/diagram.png"'
    )
  })

  it("keeps crate metadata when docs.rs fails", async () => {
    const detail = await cratesPackageHandler("react", async (url) => {
      if (url.includes("crates.io")) {
        return new Response(JSON.stringify(cratesDetailFixture), {
          status: 200,
        })
      }
      return new Response("unavailable", { status: 503 })
    })

    expect(detail.record.name).toBe("react")
    expect(detail.record.license).toBe("GPL-3.0")
    expect(detail.readmeHtml).toBeUndefined()
  })
})
