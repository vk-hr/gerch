// Opt-in smoke test against the real npm registry. Not picked up by
// `bun test`; run with `GERCH_LIVE=1 bun test ./test/live/npm.live.ts`.
import { describe, expect, test } from "vitest"

import { createNpmAdapter } from "@/server/registries/npm.ts"
import {
  packageSummariesSchema,
  packageSummarySchema,
} from "@/server/schema.ts"

describe("npm live", () => {
  test("searches the real registry", async () => {
    expect.hasAssertions()
    const results = await createNpmAdapter(fetch).search("zod")
    expect(packageSummariesSchema.parse(results)).toStrictEqual(results)
    expect(results[0]?.name).toBe("zod")
  })

  test("loads a scoped package from the real registry", async () => {
    expect.hasAssertions()
    const summary = await createNpmAdapter(fetch).package(
      "@tanstack/react-query"
    )
    const parsed: unknown = packageSummarySchema.parse(summary)
    expect(parsed).toStrictEqual(summary)
    expect(summary?.name).toBe("@tanstack/react-query")
    expect(summary?.downloads?.count).toBeGreaterThan(0)
  })
})
