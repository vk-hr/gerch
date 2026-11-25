import type { NixIndexState } from "./nix/store.ts"

const HOUR_MS = 3_600_000
// The ingest runs every 6 h; a day without a new index means it is failing.
const NIX_STALE_HOURS = 24

interface HealthDeps {
  nixState: () => Promise<NixIndexState | null>
  now: () => number
}

// Liveness, plus the nix index's release and age (docs/spec.md, "API"). It
// stays 200 while the index is old or missing, so it never takes the app
// down; `nix.stale` says when the ingest needs attention.
async function handleHealth(deps: HealthDeps): Promise<Response> {
  const state = await deps.nixState()
  const ageHours =
    state === null
      ? null
      : Math.floor((deps.now() - state.ingestedAt.getTime()) / HOUR_MS)
  return Response.json(
    {
      nix:
        state === null
          ? null
          : {
              ageHours,
              ingestedAt: state.ingestedAt.toISOString(),
              packages: state.packages,
              release: state.release,
              stale: (ageHours ?? 0) >= NIX_STALE_HOURS,
            },
      ok: true,
    },
    { headers: { "cache-control": "no-store" } }
  )
}

export { handleHealth }
