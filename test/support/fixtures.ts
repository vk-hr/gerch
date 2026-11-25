import type { Fetch } from "@/server/http.ts"
import { loadFixtures, replayFetch } from "@/server/replay.ts"

interface FixtureFetch {
  fetch: Fetch
  requests: { url: string; userAgent: string | null }[]
}

// Replays the named fixtures and records each request, so tests can assert
// on URLs and headers. Any other URL fails.
async function fixtureFetch(
  registry: string,
  names: readonly string[]
): Promise<FixtureFetch> {
  const paths = names.map(
    (name) =>
      new URL(`../fixtures/${registry}/${name}.json`, import.meta.url).pathname
  )
  const replay = replayFetch(await loadFixtures(paths))
  const requests: FixtureFetch["requests"] = []
  const fetcher: Fetch = async (input, init) => {
    requests.push({
      url: input,
      userAgent: new Headers(init?.headers).get("user-agent"),
    })
    return replay(input, init)
  }
  return { fetch: fetcher, requests }
}

function statusFetch(status: number): Fetch {
  return async () => Response.json({ error: "upstream" }, { status })
}

export { fixtureFetch, statusFetch }
