import type { PackageRecord } from "@/server/registries/record"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"

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
      className="block"
    >
      <Card
        className={cn(
          "transition-colors [--card-spacing:--spacing(3)]",
          highlighted && "ring-2 ring-primary"
        )}
      >
        <CardHeader>
          <CardTitle className="break-all">{record.name}</CardTitle>
          {record.description && (
            <CardDescription className="line-clamp-2">
              {record.description}
            </CardDescription>
          )}
          <CardAction className="flex gap-1.5">
            {record.version && (
              <Badge variant="secondary">{record.version}</Badge>
            )}
            <Badge variant="outline" className="uppercase">
              {record.registry}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex gap-3 text-xs text-muted-foreground">
          {record.license && <span>{record.license}</span>}
          {record.downloads?.monthly !== undefined && (
            <span>{formatDownloads(record.downloads.monthly)} / month</span>
          )}
          {record.downloads?.recent !== undefined && (
            <span>{formatDownloads(record.downloads.recent)} recent</span>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
