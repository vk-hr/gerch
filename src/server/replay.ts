// Replays recorded registry responses (test/fixtures/<registry>/*.json) in
// place of the network. Unit tests use it directly; the end-to-end server
// uses it when GERCH_REPLAY_DIR is set. Any URL without a fixture fails.
import { Glob } from "bun"

import type { Fetch } from "./http.ts"

interface Fixture {
  url: string
  status: number
  body: unknown
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

async function loadFixtures(paths: readonly string[]): Promise<Fixture[]> {
  return Promise.all(
    paths.map(async (path) => {
      const parsed: unknown = await Bun.file(path).json()
      if (!isFixture(parsed)) {
        throw new TypeError(`${path} is not a recorded fixture`)
      }
      return parsed
    })
  )
}

function replayFetch(fixtures: readonly Fixture[]): Fetch {
  return async (input) => {
    const fixture = fixtures.find((candidate) => candidate.url === input)
    if (fixture === undefined) {
      throw new Error(`no recorded fixture for ${input}`)
    }
    return Response.json(fixture.body, { status: fixture.status })
  }
}

async function loadDirectory(dir: string): Promise<Fetch> {
  const paths = await Array.fromAsync(
    new Glob("**/*.json").scan({ absolute: true, cwd: dir })
  )
  return replayFetch(await loadFixtures(paths))
}

// Every fixture under a directory, loaded on first use.
function replayDirectory(dir: string): Fetch {
  const loaded: { replay?: Promise<Fetch> } = {}
  return async (input, init) => {
    loaded.replay ??= loadDirectory(dir)
    const fetcher = await loaded.replay
    return fetcher(input, init)
  }
}

export { loadFixtures, replayDirectory, replayFetch }
export type { Fixture }
