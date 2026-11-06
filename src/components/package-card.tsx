import type { NixChannel } from "@/lib/nix-channel"
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
import { formatDownloads } from "@/lib/package-detail"
import { Link } from "@tanstack/react-router"
import { cn } from "cn"

export function PackageCard({
  record,
  highlighted = false,
  channel,
}: {
  record: PackageRecord
  highlighted?: boolean
  channel?: NixChannel
}) {
  return (
    <Link
      to="/$registry/$name"
      params={{
        registry: record.registry,
        name: encodeURIComponent(record.name),
      }}
      search={record.registry === "nix" && channel ? { channel } : undefined}
      className="block"
    >
      <Card
        className={cn(
          "transition-colors [--card-spacing:--spacing(3)]",
          highlighted && "outline-2 outline-primary"
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
