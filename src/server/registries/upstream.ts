import { env } from "@/env"

export const USER_AGENT =
  env.SERVER_USER_AGENT ?? "gerch (+https://github.com/gerch)"

const DEFAULT_TTL_SECONDS = 300

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

const cache = new Map<string, { body: string; expiresAt: number }>()

export function clearUpstreamCache(): void {
  cache.clear()
}

export async function fetchUpstream(
  url: string,
  init?: RequestInit,
  fetcher: Fetcher = fetch
): Promise<Response> {
  const cacheable = (init?.method ?? "GET") === "GET"
  if (cacheable) {
    const hit = cache.get(url)
    if (hit && hit.expiresAt > Date.now()) {
      return new Response(hit.body, { status: 200 })
    }
  }

  const headers = new Headers(init?.headers)
  headers.set("User-Agent", USER_AGENT)
  const response = await fetcher(url, { ...init, headers })
  if (!response.ok || !cacheable) {
    return response
  }

  const body = await response.text()
  cache.set(url, {
    body,
    expiresAt: Date.now() + ttlSeconds(response) * 1000,
  })
  return new Response(body, {
    status: response.status,
    headers: response.headers,
  })
}

function ttlSeconds(response: Response): number {
  const match = response.headers.get("cache-control")?.match(/max-age=(\d+)/)
  return match ? Number(match[1]) : DEFAULT_TTL_SECONDS
}

export function createRateLimiter(intervalMs: number) {
  let lastRequestAt = 0
  let queue: Promise<unknown> = Promise.resolve()

  return function limit(start: () => Promise<Response>): Promise<Response> {
    const run = queue.then(async () => {
      const wait = intervalMs - (Date.now() - lastRequestAt)
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait))
      }
      lastRequestAt = Date.now()
      return start()
    })
    queue = run.catch(() => {})
    return run
  }
}

export const cratesLimiter = createRateLimiter(1000)

export function fetchCrates(
  url: string,
  init?: RequestInit,
  fetcher: Fetcher = fetch
): Promise<Response> {
  return cratesLimiter(() => fetchUpstream(url, init, fetcher))
}
