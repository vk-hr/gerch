import { CopyInstallButton } from "@/components/search/copy-install-button.tsx"
import { ResultLinks } from "@/components/search/result-links.tsx"
import { formatDownloads, formatReleaseDate } from "@/shared/format.ts"
import { REGISTRY_LABELS } from "@/shared/registry.ts"
import type { PackageSummary } from "@/shared/registry.ts"

import { useCachedReleaseDate } from "./use-release-date.ts"

function PackageCard({ summary }: { summary: PackageSummary }) {
  const cachedDate = useCachedReleaseDate(summary.registry, summary.name)
  const releasedAt = summary.releasedAt ?? cachedDate
  const released = formatReleaseDate(releasedAt)
  const downloads = formatDownloads(summary.downloads)
  return (
    <article
      aria-labelledby="package-name"
      className="grid gap-3 rounded-xl border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-heading text-xl font-medium" id="package-name">
          {summary.name}
        </h1>
        <span className="font-heading text-sm text-muted-foreground">
          {summary.version}
        </span>
        {released === null ? null : (
          <time
            className="text-xs text-muted-foreground"
            dateTime={releasedAt ?? undefined}
          >
            {released}
          </time>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {REGISTRY_LABELS[summary.registry]}
        </span>
      </div>
      {summary.description === null ? null : (
        <p className="text-sm text-muted-foreground">{summary.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {summary.license === null ? null : <span>{summary.license}</span>}
        {downloads === null ? null : <span>{downloads}</span>}
        <ResultLinks result={summary} />
        <CopyInstallButton install={summary.install} />
      </div>
    </article>
  )
}

export { PackageCard }
