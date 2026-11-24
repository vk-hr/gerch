// Ends every CI job: fails it if setup or the whole job went over budget, and
// records waiting time without failing on it (docs/decisions.md D9).
interface Timing {
  createdAt: number
  startedAt: number
  setupDoneAt: number
  finishedAt: number
}

interface Budget {
  setupMs: number
  jobMs: number
}

interface Evaluation {
  waitingMs: number
  setupMs: number
  runningMs: number
  jobMs: number
  failures: string[]
}

function evaluate(timing: Timing, budget: Budget): Evaluation {
  const setupMs = timing.setupDoneAt - timing.startedAt
  const jobMs = timing.finishedAt - timing.startedAt
  const failures: string[] = []
  if (setupMs > budget.setupMs) {
    failures.push(`setup took ${setupMs} ms, budget ${budget.setupMs} ms`)
  }
  if (jobMs > budget.jobMs) {
    failures.push(`job took ${jobMs} ms, budget ${budget.jobMs} ms`)
  }
  return {
    failures,
    jobMs,
    runningMs: timing.finishedAt - timing.setupDoneAt,
    setupMs,
    waitingMs: timing.startedAt - timing.createdAt,
  }
}

interface ApiJob {
  name: string
  runner_name: string | null
  status: string
  created_at: string
  started_at: string
}

function isApiJob(value: unknown): value is ApiJob {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "status" in value &&
    typeof value.status === "string" &&
    "created_at" in value &&
    typeof value.created_at === "string" &&
    "started_at" in value &&
    typeof value.started_at === "string" &&
    "runner_name" in value &&
    (value.runner_name === null || typeof value.runner_name === "string")
  )
}

function parseJobs(body: unknown): ApiJob[] {
  if (
    typeof body !== "object" ||
    body === null ||
    !("jobs" in body) ||
    !Array.isArray(body.jobs)
  ) {
    throw new TypeError("GitHub API response has no jobs array")
  }
  return body.jobs.filter((job) => isApiJob(job))
}

// Job names are unique within a run attempt (the workflow has no matrix).
// The API can still report the running job as queued, so status is ignored.
function findJob(jobs: readonly ApiJob[], name: string): ApiJob {
  const job = jobs.find((candidate) => candidate.name === name)
  if (job === undefined) {
    throw new Error(`no job named ${name} in this run attempt`)
  }
  return job
}

function env(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set`)
  }
  return value
}

async function currentJob(): Promise<ApiJob> {
  const url = `${env("GITHUB_API_URL")}/repos/${env("GITHUB_REPOSITORY")}/actions/runs/${env("GITHUB_RUN_ID")}/attempts/${env("GITHUB_RUN_ATTEMPT")}/jobs?per_page=100`
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${env("GITHUB_TOKEN")}` },
  })
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} for ${url}`)
  }
  const jobs = parseJobs(await response.json())
  return findJob(jobs, env("GITHUB_JOB"))
}

if (import.meta.main) {
  const job = await currentJob()
  const result = evaluate(
    {
      createdAt: Date.parse(job.created_at),
      finishedAt: Date.now(),
      setupDoneAt: Number(env("GERCH_SETUP_DONE_AT")),
      startedAt: Date.parse(job.started_at),
    },
    { jobMs: Number(env("GERCH_JOB_BUDGET_MS")), setupMs: 15_000 }
  )
  const line = `| ${env("GITHUB_JOB")} | ${result.waitingMs} | ${result.setupMs} | ${result.runningMs} | ${result.jobMs} | ${result.failures.join("; ") || "ok"} |`
  const summary = `| job | waiting ms (target 5000) | setup ms (budget 15000) | running ms | job ms (budget ${env("GERCH_JOB_BUDGET_MS")}) | result |\n|---|---|---|---|---|---|\n${line}\n`
  await Bun.write(env("GITHUB_STEP_SUMMARY"), summary)
  console.log(summary)
  if (result.failures.length > 0) {
    process.exit(1)
  }
}

export { evaluate, findJob }
