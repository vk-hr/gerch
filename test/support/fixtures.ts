import type { Fetch } from "@/server/http.ts"

interface Fixture {
  url: string
  status: number
  body: unknown
}

interface FixtureFetch {
  fetch: Fetch
  requests: { url: string; userAgent: string | null }[]
}

function isFixture(value: unknown): value is Fixture {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof value.url === "string" &&
    "status" in value &&
    typeof value.status === "number" &&
    "body" in value
  )
}

async function loadFixture(registry: string, name: string): Promise<Fixture> {
  const path = new URL(`../fixtures/${registry}/${name}.json`, import.meta.url)
  const parsed: unknown = await Bun.file(path).json()
  if (!isFixture(parsed)) {
    throw new TypeError(`${registry}/${name} is not a recorded fixture`)
  }
  return parsed
}

// Serves recorded responses by URL and rejects any request it has no fixture
// for, so an adapter can't call an endpoint the fixtures don't cover.
async function fixtureFetch(
  registry: string,
  names: readonly string[]
): Promise<FixtureFetch> {
  const fixtures = await Promise.all(
    names.map(async (name) => loadFixture(registry, name))
  )
  const requests: FixtureFetch["requests"] = []
  const fetcher: Fetch = async (input, init) => {
    requests.push({
      url: input,
      userAgent: new Headers(init?.headers).get("user-agent"),
    })
    const fixture = fixtures.find((candidate) => candidate.url === input)
    if (fixture === undefined) {
      throw new Error(`no fixture for ${input}`)
    }
    return Response.json(fixture.body, { status: fixture.status })
  }
  return { fetch: fetcher, requests }
}

function statusFetch(status: number): Fetch {
  return async () => Response.json({ error: "upstream" }, { status })
}

export { fixtureFetch, statusFetch }
