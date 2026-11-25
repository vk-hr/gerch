import { formatDownloads, formatReleaseDate } from "@/shared/format.ts"
import type { PackageSummary } from "@/shared/registry.ts"

import { CopyInstallButton } from "./copy-install-button.tsx"
import { ResultLinks } from "./result-links.tsx"

function ResultCard({ result }: { result: PackageSummary }) {
  const downloads = formatDownloads(result.downloads)
  const released = formatReleaseDate(result.releasedAt)
  const headingId = `${result.registry}-${result.name}`
  return (
    <article
      aria-labelledby={headingId}
      className="rounded-xl border border-border bg-card p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      data-install={result.install}
      data-result=""
      tabIndex={-1}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-heading text-base font-medium" id={headingId}>
          {result.name}
        </h3>
        <span className="font-heading text-sm text-muted-foreground">
          {result.version}
        </span>
        {released === null ? null : (
          <time
            className="text-xs text-muted-foreground"
            dateTime={result.releasedAt ?? undefined}
          >
            {released}
          </time>
        )}
      </div>
      {result.description === null ? null : (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {result.description}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {result.license === null ? null : <span>{result.license}</span>}
        {downloads === null ? null : <span>{downloads}</span>}
        <ResultLinks result={result} />
        <CopyInstallButton install={result.install} />
      </div>
    </article>
  )
}

export { ResultCard }
