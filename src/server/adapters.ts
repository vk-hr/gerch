// Builds the registry adapters for one server instance: the network with
// timeouts and crates.io's queue in production, recorded fixtures for the
// e2e server (GERCH_REPLAY_DIR).
import type { Database } from "./db/index.ts"
import { withTimeout } from "./http.ts"
import type { Fetch } from "./http.ts"
import { fetchedNixIndex, postgresNixIndex } from "./nix/store.ts"
import { memorySlot, postgresSlot, throttledFetch } from "./rate-slot.ts"
import { createCratesAdapter } from "./registries/crates.ts"
import { createNixAdapter } from "./registries/nix.ts"
import { createNpmAdapter } from "./registries/npm.ts"
import type { SearchDeps } from "./search.ts"

// The crates.io data access policy allows 1 request per second. A request
// that would queue longer than 8 s fails instead, so a burst of searches
// can't hold function instances open (D28).
const CRATES_LIMIT = { intervalMs: 1000, key: "crates.io", maxWaitMs: 8000 }

function cratesFetch(upstream: Fetch, db: Database | undefined): Fetch {
  return throttledFetch(upstream, {
    ...CRATES_LIMIT,
    sleep: async (ms) => Bun.sleep(ms),
    slot: db === undefined ? memorySlot(Date.now) : postgresSlot(db),
  })
}

// The nix index: Postgres in production, the recorded dump in memory for
// the e2e server. Local dev without DATABASE_URL has none (D30).
function nixAdapter(db: Database | undefined, replay: Fetch | undefined) {
  if (db !== undefined) {
    return createNixAdapter(postgresNixIndex(db))
  }
  return replay === undefined
    ? undefined
    : createNixAdapter(fetchedNixIndex(replay))
}

function createAdapters(
  db: Database | undefined,
  replay: Fetch | undefined
): SearchDeps["adapters"] {
  const network = withTimeout(fetch)
  // Recorded responses never reach crates.io, so replay skips its queue.
  const crates = replay ?? cratesFetch(network, db)
  const nix = nixAdapter(db, replay)
  return {
    crate: createCratesAdapter(crates),
    npm: createNpmAdapter(replay ?? network),
    ...(nix === undefined ? {} : { nix }),
  }
}

export { createAdapters }
