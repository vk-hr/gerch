import { describe, expect, test } from "vitest"

import type { Fetch } from "@/server/http.ts"
import { createCratesAdapter } from "@/server/registries/crates.ts"

import { fixtureFetch } from "../support/fixtures.ts"

function answer(body: unknown): Fetch {
  return async () => Response.json(body)
}

const crate = {
  default_version: "2.0.0-rc.1",
  description: "pre-release only",
  homepage: null,
  max_stable_version: null,
  name: "early",
  recent_downloads: null,
  repository: "git@github.com:someone/early.git",
  updated_at: "2026-11-01T10:00:00.000000Z",
}

describe("crates.io search", () => {
  test("maps the serde search result without a license", async () => {
    expect.hasAssertions()
    const { fetch, requests } = await fixtureFetch("crate", ["search-serde"])
    const [serde] = await createCratesAdapter(fetch).search("serde")
    expect(serde).toStrictEqual({
      description: "A generic serialization/deserialization framework",
      downloads: { count: 462_050_254, window: "90d" },
      homepage: "https://serde.rs",
      install: "cargo add serde",
      // Search results carry no license; cards fill it in later (D13).
      license: null,
      name: "serde",
      registry: "crate",
      releasedAt: "2026-07-18T23:05:13.266456Z",
      repository: "https://github.com/serde-rs/serde",
      version: "1.0.229",
    })
    expect(requests.map((request) => request.url)).toStrictEqual([
      "https://crates.io/api/v1/crates?q=serde&per_page=10",
    ])
  })

  test("a crate with only pre-releases shows its default version", async () => {
    expect.hasAssertions()
    const [early] = await createCratesAdapter(
      answer({ crates: [crate] })
    ).search("early")
    expect(early).toMatchObject({
      downloads: null,
      repository: "https://github.com/someone/early",
      version: "2.0.0-rc.1",
    })
  })

  test("one malformed crate drops that crate, not the search", async () => {
    expect.hasAssertions()
    const results = await createCratesAdapter(
      answer({ crates: [{ name: 7 }, crate] })
    ).search("early")
    expect(results.map((result) => result.name)).toStrictEqual(["early"])
  })
})

describe("crates.io package", () => {
  test("maps the crate and its default version", async () => {
    expect.hasAssertions()
    const { fetch, requests } = await fixtureFetch("crate", ["package-serde"])
    await expect(
      createCratesAdapter(fetch).package("serde")
    ).resolves.toStrictEqual({
      description: "A generic serialization/deserialization framework",
      downloads: { count: 462_050_254, window: "90d" },
      homepage: "https://serde.rs",
      install: "cargo add serde",
      license: "MIT OR Apache-2.0",
      name: "serde",
      registry: "crate",
      releasedAt: "2026-07-18T23:05:13.266456Z",
      repository: "https://github.com/serde-rs/serde",
      version: "1.0.229",
    })
    // Only the default version, not every version (2.7 KB, not 441 KB).
    expect(requests.map((request) => request.url)).toStrictEqual([
      "https://crates.io/api/v1/crates/serde?include=default_version,downloads",
    ])
  })

  test("a crate whose version has no license still loads", async () => {
    expect.hasAssertions()
    const adapter = createCratesAdapter(
      answer({ crate, versions: [{ created_at: 5, num: "2.0.0-rc.1" }] })
    )
    await expect(adapter.package("early")).resolves.toMatchObject({
      license: null,
      releasedAt: "2026-11-01T10:00:00.000000Z",
      version: "2.0.0-rc.1",
    })
  })

  test.each([
    ["serde", true],
    ["serde_json", true],
    ["serde-saphyr", true],
    ["Serde", true],
    ["", false],
    ["1password", false],
    ["serde/json", false],
    ["serde json", false],
    ["a".repeat(65), false],
  ])("%p is a crate name: %p", (name, expected) => {
    expect.hasAssertions()
    expect(createCratesAdapter(answer({})).isPackageName(name)).toBe(expected)
  })
})
