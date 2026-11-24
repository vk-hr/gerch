import { describe, expect, test } from "vitest"

describe("test preload", () => {
  test("blocks network calls in unit tests", async () => {
    expect.hasAssertions()
    await expect(fetch("https://registry.npmjs.org/zod")).rejects.toThrow(
      "network is disabled in unit tests"
    )
  })
})
