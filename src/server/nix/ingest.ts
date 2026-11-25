// Refreshes the nix index from the nixos-unstable channel dump when the
// dump's ETag changes. Runs from scripts/ingest-nix.ts in a scheduled GitHub
// Actions job, never in a Vercel function: parsing the 418 MB dump peaks at
// about 2.3 GB of memory (D12, D30).
import type { Database } from "@/server/db/index.ts"
import { UpstreamError, USER_AGENT } from "@/server/http.ts"
import type { Fetch } from "@/server/http.ts"

import { CHANNEL_URL, nixRows } from "./dump.ts"
import { nixIndexState, replaceNixIndex } from "./store.ts"

type IngestResult =
  { status: "unchanged" } | { status: "replaced"; packages: number }

const HEADERS = { "user-agent": USER_AGENT }

// The channel redirects to its current release, e.g.
// releases.nixos.org/nixos/unstable/nixos-26.11pre1125864.2786a2a72088/…
function releaseOf(url: string): string | null {
  return (
    /^https:\/\/releases\.nixos\.org\/.+\/(?<release>nixos-[^/]+)\/packages\.json\.br$/u.exec(
      url
    )?.groups?.release ?? null
  )
}

// Whether the channel's current dump is the one already in the index.
async function unchanged(db: Database, fetcher: Fetch): Promise<boolean> {
  const head = await fetcher(CHANNEL_URL, { headers: HEADERS, method: "HEAD" })
  const etag = head.headers.get("etag")
  const current = await nixIndexState(db)
  return etag !== null && current?.etag === etag
}

async function runNixIngest(
  db: Database,
  fetcher: Fetch
): Promise<IngestResult> {
  if (await unchanged(db, fetcher)) {
    return { status: "unchanged" }
  }
  const response = await fetcher(CHANNEL_URL, { headers: HEADERS })
  if (!response.ok) {
    throw new UpstreamError(CHANNEL_URL, response.status)
  }
  // Served with `content-encoding: br`, so fetch decodes the Brotli.
  const rows = nixRows(await response.json())
  await replaceNixIndex(db, rows, {
    etag: response.headers.get("etag"),
    release: releaseOf(response.url),
  })
  return { packages: rows.length, status: "replaced" }
}

export { releaseOf, runNixIngest }
export type { IngestResult }
