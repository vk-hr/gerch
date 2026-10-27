import {
  clearUpstreamCache,
  fetchCrates,
  fetchUpstream,
  USER_AGENT,
} from "@/server/registries/upstream.server"
import { afterEach, describe, expect, it, vi } from "vitest"

const okJson = (headers = {}) =>
  new Response(JSON.stringify({ ok: true }), { status: 200, headers })

afterEach(() => {
  vi.useRealTimers()
  clearUpstreamCache()
})

describe("fetchUpstream", () => {
  it("sends the User-Agent header", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("User-Agent")).toBe(USER_AGENT)
      return okJson()
    })
    await fetchUpstream("https://example.test/ua", {}, fetcher)
  })

  it("serves repeated GETs from the cache", async () => {
    const fetcher = vi.fn(async () => okJson())
    await fetchUpstream("https://example.test/cached", {}, fetcher)
    await fetchUpstream("https://example.test/cached", {}, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("honours Cache-Control max-age", async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn(async () =>
      okJson({ "cache-control": "public, max-age=60" })
    )
    await fetchUpstream("https://example.test/ttl", {}, fetcher)
    await vi.advanceTimersByTimeAsync(30_000)
    await fetchUpstream("https://example.test/ttl", {}, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(31_000)
    await fetchUpstream("https://example.test/ttl", {}, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("does not cache no-store or no-cache responses", async () => {
    const noStore = vi.fn(async () => okJson({ "cache-control": "no-store" }))
    await fetchUpstream("https://example.test/no-store", {}, noStore)
    await fetchUpstream("https://example.test/no-store", {}, noStore)
    expect(noStore).toHaveBeenCalledTimes(2)

    const noCache = vi.fn(async () =>
      okJson({ "cache-control": "no-cache, max-age=3600" })
    )
    await fetchUpstream("https://example.test/no-cache", {}, noCache)
    await fetchUpstream("https://example.test/no-cache", {}, noCache)
    expect(noCache).toHaveBeenCalledTimes(2)
  })

  it("does not cache error responses", async () => {
    const fetcher = vi.fn(async () => new Response("nope", { status: 404 }))
    await fetchUpstream("https://example.test/missing", {}, fetcher)
    await fetchUpstream("https://example.test/missing", {}, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("does not cache non-GET requests", async () => {
    const fetcher = vi.fn(async () => okJson())
    await fetchUpstream(
      "https://example.test/post",
      { method: "POST", body: "{}" },
      fetcher
    )
    await fetchUpstream(
      "https://example.test/post",
      { method: "POST", body: "{}" },
      fetcher
    )
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

describe("fetchCrates", () => {
  it("spaces crates.io requests by one second", async () => {
    vi.useFakeTimers()
    const calls: number[] = []
    const fetcher = vi.fn(async () => {
      calls.push(Date.now())
      return new Response("{}", { status: 200 })
    })
    const p1 = fetchCrates("https://crates.test/a", {}, fetcher)
    const p2 = fetchCrates("https://crates.test/b", {}, fetcher)
    const p3 = fetchCrates("https://crates.test/c", {}, fetcher)
    await vi.advanceTimersByTimeAsync(3000)
    await Promise.all([p1, p2, p3])
    expect(calls).toHaveLength(3)
    expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(1000)
    expect(calls[2] - calls[1]).toBeGreaterThanOrEqual(1000)
  })
})
