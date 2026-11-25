import { describe, expect, test } from "vitest"

import { listedTests, shardProblems } from "../../scripts/check-e2e-shards.ts"

const LIST = `Listing tests:
  search.e2e.ts:12:1 › the home page answers without a redirect
  tabs.e2e.ts:81:1 › a click activates a tab
Total: 2 tests in 2 files
`

describe("listedTests()", () => {
  test("reads the test lines of playwright --list", () => {
    expect.hasAssertions()
    expect(listedTests(LIST)).toStrictEqual([
      "search.e2e.ts:12:1 › the home page answers without a redirect",
      "tabs.e2e.ts:81:1 › a click activates a tab",
    ])
  })
})

describe("shardProblems()", () => {
  const all = ["a", "b", "c"]

  test("passes shards that list every test once", () => {
    expect.hasAssertions()
    expect(shardProblems(all, [["a"], ["b", "c"], []])).toStrictEqual([])
  })

  test("reports a test no shard runs and a test two shards run", () => {
    expect.hasAssertions()
    expect(shardProblems(all, [["a", "b"], ["b"]])).toStrictEqual([
      "no shard runs c",
      "2 shards run b",
    ])
  })
})
