import { describe, expect, test } from "vitest"

import { testPlan } from "../../scripts/select-tests.ts"

describe("testPlan()", () => {
  test("runs everything when a shared input changes", () => {
    expect.hasAssertions()
    for (const file of [
      "package.json",
      "bun.lock",
      "bunfig.toml",
      "tsconfig.json",
      "vite.config.ts",
      "flake.nix",
      "flake.lock",
      "test/vitest.d.ts",
      "test/fixtures/npm/search-zod.json",
      ".github/workflows/ci.yml",
      "scripts/select-tests.ts",
      "drizzle.config.ts",
      "drizzle/20261124202437_cache_entries/migration.sql",
    ]) {
      expect(testPlan([file])).toStrictEqual({ mode: "all", reason: file })
    }
  })

  test("narrows to affected tests for source-only diffs", () => {
    expect.hasAssertions()
    expect(testPlan(["src/routes/index.tsx", "docs/spec.md"])).toStrictEqual({
      mode: "changed",
    })
  })

  test("runs nothing for an empty diff", () => {
    expect.hasAssertions()
    expect(testPlan([])).toStrictEqual({ mode: "none" })
  })
})
