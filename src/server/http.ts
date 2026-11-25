import packageJson from "~/package.json" with { type: "json" }

const USER_AGENT = `gerch/${packageJson.version} (+https://github.com/vk-hr/gerch)`
const UPSTREAM_TIMEOUT_MS = 5000

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

class UpstreamError extends Error {
  public readonly status: number

  public constructor(url: string, status: number) {
    super(`upstream ${status} for ${url}`)
    this.name = "UpstreamError"
    this.status = status
  }
}

// Gives each request its own timeout, started when the request starts. It
// wraps the network fetch directly, inside any rate-limit queue, so time
// spent waiting for a turn doesn't count against the request (D28).
function withTimeout(fetcher: Fetch, ms = UPSTREAM_TIMEOUT_MS): Fetch {
  return async (input, init) =>
    fetcher(input, { ...init, signal: AbortSignal.timeout(ms) })
}

async function getJson(fetcher: Fetch, url: string): Promise<unknown> {
  const response = await fetcher(url, {
    headers: { accept: "application/json", "user-agent": USER_AGENT },
  })
  if (!response.ok) {
    throw new UpstreamError(url, response.status)
  }
  return response.json()
}

export { getJson, UpstreamError, USER_AGENT, withTimeout }
export type { Fetch }
