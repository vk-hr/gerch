import { describe, expect, test } from "vitest"

import {
  interactionDurations,
  percentile,
} from "../../scripts/measure-renderers.ts"

describe("percentile()", () => {
  test.each([
    [[5, 1, 3], 50, 3],
    [[1, 2, 3, 4], 75, 3],
    [[10], 75, 10],
    [[1, 2, 3, 4, 5, 6, 7], 50, 4],
  ])("the p%# of %p", (values, at, expected) => {
    expect.hasAssertions()
    expect(percentile(values, at)).toBe(expected)
  })

  test("is null for no values", () => {
    expect.hasAssertions()
    expect(percentile([], 50)).toBeNull()
  })
})

describe("interactionDurations()", () => {
  test("keeps the longest event of each interaction, like INP", () => {
    expect.hasAssertions()
    expect(
      interactionDurations([
        { duration: 24, interactionId: 1 },
        { duration: 40, interactionId: 1 },
        { duration: 16, interactionId: 2 },
        { duration: 56, interactionId: 0 },
      ])
    ).toStrictEqual([40, 16])
  })
})
