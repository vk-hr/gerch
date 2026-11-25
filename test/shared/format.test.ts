import { describe, expect, test } from "vitest"

import { formatDownloads, formatReleaseDate } from "@/shared/format.ts"

describe("formatDownloads()", () => {
  test.each([
    [{ count: 468_631_616, window: "week" as const }, "469M/wk"],
    [{ count: 1234, window: "90d" as const }, "1.23K/90d"],
    [{ count: 7, window: "week" as const }, "7/wk"],
    [null, null],
  ])("%j", (downloads, expected) => {
    expect.hasAssertions()
    expect(formatDownloads(downloads)).toBe(expected)
  })
})

describe("formatReleaseDate()", () => {
  test("renders the same calendar date on server and client", () => {
    expect.hasAssertions()
    expect(formatReleaseDate("2026-10-12T16:29:37.778Z")).toBe("2026-10-12")
    expect(formatReleaseDate(null)).toBeNull()
  })
})
