import type { PackageSummary } from "./registry.ts"

// A fixed locale, so the server and the browser render the same text.
const COMPACT = new Intl.NumberFormat("en", {
  maximumSignificantDigits: 3,
  notation: "compact",
})
const WINDOW_LABEL = { "90d": "90d", week: "wk" } as const
const DATE_LENGTH = 10

function formatDownloads(
  downloads: PackageSummary["downloads"]
): string | null {
  if (downloads === null) {
    return null
  }
  return `${COMPACT.format(downloads.count)}/${WINDOW_LABEL[downloads.window]}`
}

// The UTC calendar date. A relative date ("3 weeks ago") would differ between
// server render and hydration.
function formatReleaseDate(releasedAt: string | null): string | null {
  return releasedAt === null ? null : releasedAt.slice(0, DATE_LENGTH)
}

export { formatDownloads, formatReleaseDate }
