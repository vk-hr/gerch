import { describe, expect, test } from "vitest"

import { createNpmAdapter } from "@/server/registries/npm.ts"

import { fixtureFetch } from "../support/fixtures.ts"

describe("npm adapter", () => {
  test("maps the zod search result", async () => {
    expect.hasAssertions()
    const { fetch } = await fixtureFetch("npm", ["search-zod"])
    const [zod] = await createNpmAdapter(fetch).search("zod")
    expect(zod).toMatchObject({
      homepage: "https://zod.dev",
      install: "npm i zod",
      license: "MIT",
      name: "zod",
      registry: "npm",
      repository: "https://github.com/colinhacks/zod",
    })
    expect(zod?.downloads?.window).toBe("week")
    expect(zod?.description).toContain("TypeScript-first")
  })
})
