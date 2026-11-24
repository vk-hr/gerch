import { describe, expect, test } from "vitest"

import { increment } from "../fixtures/isolation-counter.ts"

describe("bun test --isolate=modules", () => {
  test("loads each test file's modules afresh", () => {
    expect.hasAssertions()
    expect(increment()).toBe(1)
  })
})
