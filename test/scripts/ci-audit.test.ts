import { describe, expect, test } from "vitest"

import {
  auditRows,
  jobPhases,
  percentile,
  runResultMs,
  shardFamily,
} from "../../scripts/ci-audit.ts"

const at = (seconds: number) =>
  new Date(Date.UTC(2026, 10, 25, 23, 0, seconds)).toISOString()

const BUILD = {
  completed_at: at(20),
  created_at: at(0),
  name: "build",
  started_at: at(2),
  steps: [
    { completed_at: at(3), name: "Set up job", started_at: at(2) },
    {
      completed_at: at(4),
      name: "Run actions/checkout@abc",
      started_at: at(3),
    },
    {
      completed_at: at(8),
      name: "Run ./.github/actions/setup",
      started_at: at(4),
    },
    { completed_at: at(18), name: "build", started_at: at(8) },
  ],
}

describe("jobPhases()", () => {
  test("splits a job into waiting, setup (through the setup action) and running", () => {
    expect.hasAssertions()
    expect(jobPhases(BUILD)).toStrictEqual({
      name: "build",
      runningMs: 12_000,
      setupMs: 6000,
      waitingMs: 2000,
    })
  })

  test("skips a job that never started or has no setup step", () => {
    expect.hasAssertions()
    expect(jobPhases({ ...BUILD, started_at: null })).toBeNull()
    expect(jobPhases({ ...BUILD, steps: [] })).toBeNull()
  })
})

describe("shardFamily()", () => {
  test.each([
    ["e2e", "e2e (4 shards)"],
    ["e2e-3", "e2e (4 shards)"],
    ["build", "build"],
  ])("files %p under %p", (name, family) => {
    expect.hasAssertions()
    expect(shardFamily(name)).toBe(family)
  })
})

describe("percentile()", () => {
  test.each([
    [[3, 1, 2], 50, 2],
    [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      95,
      19,
    ],
  ])("the p%# of %p", (values, at95, expected) => {
    expect.hasAssertions()
    expect(percentile(values, at95)).toBe(expected)
  })
})

describe("runResultMs()", () => {
  test("is the time from a run's creation to its last job finishing", () => {
    expect.hasAssertions()
    expect(
      runResultMs(at(0), [BUILD, { ...BUILD, completed_at: at(45) }])
    ).toBe(45_000)
  })
})

describe("auditRows()", () => {
  test("reports p50 and p95 of each phase per job family, shards together", () => {
    expect.hasAssertions()
    const phases = [
      { name: "e2e", runningMs: 10_000, setupMs: 6000, waitingMs: 1000 },
      { name: "e2e-2", runningMs: 14_000, setupMs: 8000, waitingMs: 3000 },
      { name: "build", runningMs: 4000, setupMs: 5000, waitingMs: 2000 },
    ]
    expect(auditRows(phases)).toStrictEqual([
      {
        jobs: 1,
        name: "build",
        running: "4.0 / 4.0",
        setup: "5.0 / 5.0",
        waiting: "2.0 / 2.0",
      },
      {
        jobs: 2,
        name: "e2e (4 shards)",
        running: "10.0 / 14.0",
        setup: "6.0 / 8.0",
        waiting: "1.0 / 3.0",
      },
    ])
  })
})
