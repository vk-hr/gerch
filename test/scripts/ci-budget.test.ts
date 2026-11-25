import { describe, expect, test } from "vitest"

import { evaluate, findJob, jobName } from "../../scripts/ci-budget.ts"

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

const job = (name: string, status: string) => ({
  created_at: "2026-11-24T20:26:19Z",
  name,
  runner_name: "GitHub Actions 1",
  started_at: "2026-11-24T20:26:21Z",
  status,
})

describe("findJob()", () => {
  test("finds the job by name whatever status the API reports yet", () => {
    expect.hasAssertions()
    const queued = job("test-changed", "queued")
    const jobs = [job("checks", "in_progress"), queued]
    expect(findJob(jobs, "test-changed")).toStrictEqual(queued)
  })

  test("throws when the run has no job with that name", () => {
    expect.hasAssertions()
    expect(() => findJob([job("checks", "in_progress")], "build")).toThrow(
      "no job named build in this run attempt"
    )
  })
})

describe("jobName()", () => {
  test("is the job id unless a matrix job names itself", () => {
    expect.hasAssertions()
    expect(jobName({ GERCH_JOB_NAME: "", GITHUB_JOB: "e2e" })).toBe("e2e")
    expect(jobName({ GERCH_JOB_NAME: "e2e-2", GITHUB_JOB: "e2e" })).toBe(
      "e2e-2"
    )
  })
})
