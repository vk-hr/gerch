// Opt-in smoke test against the real crates.io API. Not picked up by
// `bun test`; run with `GERCH_LIVE=1 bun test ./test/live/crate.live.ts`.
// The two requests run one after the other, more than a second apart, as
// the crates.io data access policy asks.
import { describe, expect, test } from "vitest"

import { createCratesAdapter } from "@/server/registries/crates.ts"
import {
  packageSummariesSchema,
  packageSummarySchema,
} from "@/server/schema.ts"

const SPACING_MS = 1100

describe("crates.io live", () => {
  test("searches and loads a crate from the real API", async () => {
    expect.hasAssertions()
    const adapter = createCratesAdapter(fetch)
    const results = await adapter.search("serde")
    expect(packageSummariesSchema.parse(results)).toStrictEqual(results)
    expect(results[0]?.name).toBe("serde")
    await Bun.sleep(SPACING_MS)
    const serde = await adapter.package("serde")
    const parsed: unknown = packageSummarySchema.parse(serde)
    expect(parsed).toStrictEqual(serde)
    expect(serde?.license).toBe("MIT OR Apache-2.0")
    expect(serde?.downloads?.count).toBeGreaterThan(0)
  })
})
