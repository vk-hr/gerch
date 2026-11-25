import type { RefreshFailure } from "./cache.ts"
import type { NixIndexState } from "./nix/store.ts"

const HOUR_MS = 3_600_000
// The ingest runs every 6 h; a day without a new index means it is failing.
const NIX_STALE_HOURS = 24

interface HealthDeps {
  nixState: () => Promise<NixIndexState | null>
  now: () => number
  // Failed background refreshes at or after a time (cache.ts).
  refreshFailures: (since: number) => Promise<RefreshFailure[]>
}

// Liveness, plus the nix index's release and age (docs/spec.md, "API"). It
// stays 200 while the index is old or missing, so it never takes the app
// down; `nix.stale` says when the ingest needs attention.
function nixReport(state: NixIndexState | null, now: number) {
  if (state === null) {
    return null
  }
  const ageHours = Math.floor((now - state.ingestedAt.getTime()) / HOUR_MS)
  return {
    ageHours,
    ingestedAt: state.ingestedAt.toISOString(),
    packages: state.packages,
    release: state.release,
    stale: ageHours >= NIX_STALE_HOURS,
  }
}

async function handleHealth(deps: HealthDeps): Promise<Response> {
  const nix = await deps.nixState().then(
    (state) => nixReport(state, deps.now()),
    () => ({ error: "the nix index can't be read" })
  )
  // Stale data keeps being served while a registry fails; this says which
  // registries failed to refresh in the last hour (docs/spec.md, "Cache").
  const refreshFailures = await deps.refreshFailures(deps.now() - HOUR_MS).then(
    (failures) =>
      failures.map((failure) => ({
        ...failure,
        at: new Date(failure.at).toISOString(),
      })),
    () => ({ error: "the cache can't be read" })
  )
  return Response.json(
    { nix, ok: true, refreshFailures },
    { headers: { "cache-control": "no-store" } }
  )
}

export { handleHealth }
