import { describe, expect, test } from "vitest"

import {
  durationsFromReport,
  listedFlows,
  oversizedFiles,
  partitionProblems,
  planShards,
  ranProblems,
} from "../../scripts/e2e-shards.ts"

const LIST = `Listing tests:
  search.e2e.ts:12:1 › the home page answers without a redirect
  theme.e2e.ts:9:3 › on a dark system › the page is dark from the first paint
  tabs.e2e.ts:81:1 › a click activates a tab
Total: 3 tests in 3 files
`

// The shape of Playwright's JSON reporter, trimmed to what gerch reads.
const REPORT = {
  suites: [
    {
      file: "theme.e2e.ts",
      specs: [],
      suites: [
        {
          specs: [
            {
              file: "theme.e2e.ts",
              line: 9,
              tests: [{ results: [{ duration: 1200, status: "passed" }] }],
              title: "the page is dark from the first paint",
            },
          ],
          suites: [],
          title: "on a dark system",
        },
      ],
      title: "theme.e2e.ts",
    },
    {
      file: "search.e2e.ts",
      specs: [
        {
          file: "search.e2e.ts",
          line: 12,
          tests: [{ results: [{ duration: 300, status: "passed" }] }],
          title: "the home page answers without a redirect",
        },
      ],
      suites: [],
      title: "search.e2e.ts",
    },
  ],
}

const flow = (key: string, location: string) => ({ key, location })

// The last letter of each planned flow's key, per shard.
const keys = (shards: { key: string }[][]) =>
  shards.map((shard) => shard.map((planned) => planned.key.slice(-1)))

describe("listedFlows()", () => {
  test("reads each flow's key and location from playwright --list", () => {
    expect.hasAssertions()
    expect(listedFlows(LIST)).toStrictEqual([
      flow(
        "search.e2e.ts › the home page answers without a redirect",
        "e2e/search.e2e.ts:12"
      ),
      flow(
        "theme.e2e.ts › on a dark system › the page is dark from the first paint",
        "e2e/theme.e2e.ts:9"
      ),
      flow("tabs.e2e.ts › a click activates a tab", "e2e/tabs.e2e.ts:81"),
    ])
  })
})

describe("durationsFromReport()", () => {
  test("keys each flow's duration like --list, describe titles included", () => {
    expect.hasAssertions()
    expect(durationsFromReport(REPORT)).toStrictEqual({
      "search.e2e.ts › the home page answers without a redirect": 300,
      "theme.e2e.ts › on a dark system › the page is dark from the first paint": 1200,
    })
  })
})

describe("planShards()", () => {
  const flows = ["a", "b", "c", "d", "e"].map((name) =>
    flow(`x.e2e.ts › ${name}`, `e2e/x.e2e.ts:${name.codePointAt(0)}`)
  )

  test("puts the longest flows first, each on the least loaded shard", () => {
    expect.hasAssertions()
    const timings = {
      "x.e2e.ts › a": 5000,
      "x.e2e.ts › b": 4000,
      "x.e2e.ts › c": 3000,
      "x.e2e.ts › d": 2000,
      "x.e2e.ts › e": 2000,
    }
    expect(keys(planShards(flows, timings, 2))).toStrictEqual([
      ["a", "d", "e"],
      ["b", "c"],
    ])
  })

  test("gives a flow without a recorded time the median time", () => {
    expect.hasAssertions()
    const timings = {
      "x.e2e.ts › a": 9000,
      "x.e2e.ts › b": 1000,
      "x.e2e.ts › c": 3000,
    }
    // The flows d and e count 3000 ms each, so after a | c d e the shards
    // tie at 9000 ms and b goes to the first one.
    expect(keys(planShards(flows, timings, 2))).toStrictEqual([
      ["a", "b"],
      ["c", "d", "e"],
    ])
  })

  test("splits evenly when nothing is recorded yet", () => {
    expect.hasAssertions()
    expect(keys(planShards(flows, {}, 2))).toStrictEqual([
      ["a", "c", "e"],
      ["b", "d"],
    ])
  })
})

describe("partitionProblems()", () => {
  test("passes a plan that runs every flow exactly once", () => {
    expect.hasAssertions()
    const [first, second] = [flow("a", "1"), flow("b", "2")]
    expect(
      partitionProblems([first, second], [[first], [second]])
    ).toStrictEqual([])
  })

  test("reports a flow no shard runs and a flow two shards run", () => {
    expect.hasAssertions()
    const [first, second] = [flow("a", "1"), flow("b", "2")]
    expect(
      partitionProblems([first, second], [[first], [first]])
    ).toStrictEqual(["no shard runs b", "2 shards run a"])
  })
})

describe("ranProblems()", () => {
  test("reports planned flows a shard didn't run and flows it ran unplanned", () => {
    expect.hasAssertions()
    expect(
      ranProblems(
        [
          "search.e2e.ts › the home page answers without a redirect",
          "tabs.e2e.ts › x",
        ],
        REPORT
      )
    ).toStrictEqual([
      "planned but not run: tabs.e2e.ts › x",
      "ran but not planned: theme.e2e.ts › on a dark system › the page is dark from the first paint",
    ])
  })
})

describe("oversizedFiles()", () => {
  test("names each e2e file whose flows add up to more than 20 s", () => {
    expect.hasAssertions()
    expect(
      oversizedFiles({
        "a.e2e.ts › one": 12_000,
        "a.e2e.ts › two": 9000,
        "b.e2e.ts › one": 19_000,
      })
    ).toStrictEqual(["a.e2e.ts takes 21000 ms; split it (over 20000 ms)"])
  })
})
