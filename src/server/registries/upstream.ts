import { env } from "@/env"
import ky, { HTTPError } from "ky"
import { LRUCache } from "lru-cache"
import PQueue from "p-queue"

export const USER_AGENT =
  env.SERVER_USER_AGENT ?? "gerch (+https://github.com/gerch)"

export class UpstreamError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "UpstreamError"
  }
}

export async function ensureOk(
  response: Response,
  what: string
): Promise<void> {
  if (!response.ok) {
    throw new UpstreamError(response.status, `${what}: ${response.status}`)
  }
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  fetcher: Fetcher = fetch
): Promise<T> {
  const response = await fetchUpstream(url, init, fetcher)
  await ensureOk(response, url)
  return response.json()
}

export async function fetchCratesJson<T>(
  url: string,
  init?: RequestInit,
  fetcher: Fetcher = fetch
): Promise<T> {
  const response = await fetchCrates(url, init, fetcher)
  await ensureOk(response, url)
  return response.json()
}

const DEFAULT_TTL_SECONDS = 300

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>

const cache = new LRUCache<string, { body: string; headers: Headers }>({
  max: 500,
  ttl: DEFAULT_TTL_SECONDS * 1000,
  perf: { now: () => Date.now() },
})

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
    if (hit) {
      return new Response(hit.body, { status: 200, headers: hit.headers })
    }
  }

  const headers = new Headers(init?.headers)
  headers.set("User-Agent", USER_AGENT)
  let response: Response
  try {
    response = await ky(url, {
      ...init,
      headers,
      fetch: (input: RequestInfo | URL, requestInit?: RequestInit) =>
        fetcher(input instanceof Request ? input.url : input.toString(), {
          ...init,
          ...requestInit,
          headers:
            input instanceof Request ? input.headers : requestInit?.headers,
        }),
      retry: 0,
      timeout: false,
    })
  } catch (error) {
    if (error instanceof HTTPError) return error.response
    throw error
  }
  if (!response.ok || !cacheable) {
    return response
  }

  const ttl = ttlSeconds(response)
  if (ttl === 0) return response

  const body = await response.text()
  cache.set(url, { body, headers: response.headers }, { ttl: ttl * 1000 })
  return new Response(body, {
    status: response.status,
    headers: response.headers,
  })
}

function ttlSeconds(response: Response): number {
  const cacheControl = response.headers.get("cache-control")
  if (!cacheControl) return DEFAULT_TTL_SECONDS
  if (/\bno-store\b|\bno-cache\b/.test(cacheControl)) return 0
  const match = cacheControl.match(/max-age=(\d+)/)
  return match ? Number(match[1]) : DEFAULT_TTL_SECONDS
}

const cratesQueue = new PQueue({ intervalCap: 1, interval: 1000 })

export function fetchCrates(
  url: string,
  init?: RequestInit,
  fetcher: Fetcher = fetch
): Promise<Response> {
  return cratesQueue.add(() => fetchUpstream(url, init, fetcher))
}
