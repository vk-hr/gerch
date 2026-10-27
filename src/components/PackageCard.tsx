import type { PackageRecord } from "@/server/registries/record"

import { Link } from "@tanstack/react-router"

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return String(count)
}

export function PackageCard({
  record,
  highlighted = false,
}: {
  record: PackageRecord
  highlighted?: boolean
}) {
  return (
    <Link
      to="/$registry/$name"
      params={{
        registry: record.registry,
        name: encodeURIComponent(record.name),
      }}
      className={`block rounded-md border p-3 transition-colors ${
        highlighted
          ? "border-primary bg-accent"
          : "border-transparent hover:bg-accent"
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-medium break-all">{record.name}</span>
        {record.version && (
          <span className="text-xs text-muted-foreground">
            {record.version}
          </span>
        )}
        <span className="ml-auto shrink-0 text-xs text-muted-foreground uppercase">
          {record.registry}
        </span>
      </div>
      {record.description && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {record.description}
        </p>
      )}
      <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
        {record.license && <span>{record.license}</span>}
        {record.downloads?.monthly !== undefined && (
          <span>{formatDownloads(record.downloads.monthly)} / month</span>
        )}
        {record.downloads?.recent !== undefined && (
          <span>{formatDownloads(record.downloads.recent)} recent</span>
        )}
      </div>
    </Link>
  )
}
