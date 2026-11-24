import { describe, expect, test } from "vitest"

import { evaluate } from "../../scripts/ci-budget.ts"

const budget = { jobMs: 35_000, setupMs: 15_000 }

describe("evaluate()", () => {
  test("passes a job inside every budget", () => {
    expect.hasAssertions()
    const timing = {
      createdAt: 0,
      finishedAt: 30_000,
      setupDoneAt: 14_000,
      startedAt: 2000,
    }
    expect(evaluate(timing, budget)).toStrictEqual({
      failures: [],
      jobMs: 28_000,
      runningMs: 16_000,
      setupMs: 12_000,
      waitingMs: 2000,
    })
  })

  test("fails setup over 15 s and a job over 35 s", () => {
    expect.hasAssertions()
    const timing = {
      createdAt: 0,
      finishedAt: 40_000,
      setupDoneAt: 20_000,
      startedAt: 1000,
    }
    expect(evaluate(timing, budget).failures).toStrictEqual([
      "setup took 19000 ms, budget 15000 ms",
      "job took 39000 ms, budget 35000 ms",
    ])
  })

  test("reports waiting without failing on it", () => {
    expect.hasAssertions()
    const timing = {
      createdAt: 0,
      finishedAt: 70_000,
      setupDoneAt: 65_000,
      startedAt: 60_000,
    }
    const result = evaluate(timing, budget)
    expect(result.waitingMs).toBe(60_000)
    expect(result.failures).toStrictEqual([])
  })
})
