import { InstallCommand } from "@/components/install-command"
import { PinToggle } from "@/components/pin-toggle"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useNixChannel } from "@/hooks/use-nix-channel"
import { NIX_CHANNELS } from "@/lib/nix-channel"
import {
  formatDownloads,
  installCommand,
  packageHomepages,
  packageLicenses,
} from "@/lib/package-detail"
import { openTab } from "@/lib/workspace"
import { getPackage } from "@/server/packages"
import {
  createFileRoute,
  Link,
  notFound,
  type ErrorComponentProps,
} from "@tanstack/react-router"
import {
  BookOpenIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  DownloadIcon,
  ExternalLinkIcon,
  GitBranchIcon,
  GlobeIcon,
  HistoryIcon,
  HouseIcon,
  LinkIcon,
  RotateCcwIcon,
  ScaleIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react"
import { useEffect } from "react"
import { z } from "zod"

export const Route = createFileRoute("/$registry/$name")({
  validateSearch: z.object({
    channel: z.enum(NIX_CHANNELS).optional(),
  }),
  loaderDeps: ({ search }) => ({ channel: search.channel }),
  loader: async ({ params, deps }) => {
    const detail = await getPackage({
      data: {
        registry: params.registry,
        name: decodeURIComponent(params.name),
        channel: deps.channel,
      },
    })
    if ("notFound" in detail) throw notFound()
    return detail
  },
  component: PackagePage,
  pendingComponent: PackagePending,
  notFoundComponent: PackageNotFound,
  errorComponent: PackageError,
})

function PackageNotFound() {
  return (
    <div className="p-6">
      <Alert>
        <TriangleAlertIcon />
        <AlertTitle>Package not found</AlertTitle>
        <AlertDescription>
          This package does not exist in the selected registry or channel.
        </AlertDescription>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link to="/" />}
          className="self-start"
        >
          Back to search
        </Button>
      </Alert>
    </div>
  )
}

function PackagePending() {
  return (
    <div className="flex flex-col p-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="mt-3 h-8 w-2/3" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-6 h-10 w-full" />
        <Skeleton className="mt-8 h-64 w-full" />
      </div>
    </div>
  )
}

function PackageError({ error, reset }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="p-6">
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>Could not load this package</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
        <Button
          variant="outline"
          size="sm"
          onClick={reset}
          className="self-start"
        >
          <RotateCcwIcon data-icon="inline-start" />
          Retry
        </Button>
      </Alert>
    </div>
  )
}

const linkIcons: Record<string, LucideIcon> = {
  registry: GlobeIcon,
  repository: GitBranchIcon,
  documentation: BookOpenIcon,
  issues: CircleAlertIcon,
}

function MetadataLabel({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: React.ReactNode
}) {
  return (
    <dt className="flex w-28 shrink-0 items-center gap-2 text-muted-foreground">
      <Icon className="size-4 shrink-0" />
      {children}
    </dt>
  )
}

function PackagePage() {
  const { record, readmeHtml, versions, degraded } = Route.useLoaderData()
  const { channel: urlChannel } = Route.useSearch()
  const [savedChannel] = useNixChannel()
  const navigate = Route.useNavigate()
  const command = installCommand(record)
  const licenses = packageLicenses(record)
  const homepages = packageHomepages(record)
  const otherLinks = Object.entries(record.links).filter(
    ([kind, url]) => kind !== "homepage" && url
  )
  const primaryLink =
    record.links.repository ??
    record.links.documentation ??
    homepages[0] ??
    record.links.registry
  const hasMetadata =
    licenses.length > 0 ||
    record.downloads ||
    homepages.length > 0 ||
    otherLinks.length > 0

  useEffect(() => {
    openTab({ registry: record.registry, name: record.name })
  }, [record.registry, record.name])

  useEffect(() => {
    if (
      record.registry === "nix" &&
      !urlChannel &&
      savedChannel !== "nixos-unstable"
    ) {
      void navigate({
        to: "/$registry/$name",
        params: {
          registry: record.registry,
          name: encodeURIComponent(record.name),
        },
        search: { channel: savedChannel },
        replace: true,
      })
    }
  }, [record.registry, record.name, urlChannel, savedChannel, navigate])

  return (
    <div className="relative flex flex-col p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={<Link to="/" />}
          className="absolute top-4 left-4"
          aria-label="Back to search"
          title="Back to search"
        >
          <ArrowLeftIcon />
        </Button>
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="uppercase">
              {record.registry}
            </Badge>
            {record.version && (
              <Badge variant="secondary">{record.version}</Badge>
            )}
            {record.registry === "nix" && (
              <Badge variant="outline">{urlChannel ?? savedChannel}</Badge>
            )}
          </div>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h1 className="min-w-0 text-2xl font-semibold break-all">
              {record.name}
            </h1>
            <div className="flex shrink-0 gap-2">
              <PinToggle registry={record.registry} name={record.name} />
              {primaryLink && (
                <Button
                  variant="outline"
                  size="icon-sm"
                  nativeButton={false}
                  render={
                    <a href={primaryLink} target="_blank" rel="noreferrer" />
                  }
                  aria-label="Open project"
                  title="Open project"
                >
                  <ExternalLinkIcon data-icon="inline-start" />
                </Button>
              )}
            </div>
          </div>
          {record.description && (
            <p className="mt-3 text-muted-foreground">{record.description}</p>
          )}
        </header>

        {degraded && (
          <Alert>
            <TriangleAlertIcon />
            <AlertDescription>
              Some package metadata is unavailable right now.
            </AlertDescription>
          </Alert>
        )}

        {command && <InstallCommand command={command} />}

        {hasMetadata && (
          <section aria-labelledby="details-heading">
            <h2 id="details-heading" className="text-sm font-medium">
              Package details
            </h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              {licenses.length > 0 && (
                <div className="flex gap-3">
                  <MetadataLabel icon={ScaleIcon}>License</MetadataLabel>
                  <dd>{licenses.join(", ")}</dd>
                </div>
              )}
              {record.downloads?.monthly !== undefined && (
                <div className="flex gap-3">
                  <MetadataLabel icon={DownloadIcon}>Downloads</MetadataLabel>
                  <dd>{formatDownloads(record.downloads.monthly)} / month</dd>
                </div>
              )}
              {record.downloads?.recent !== undefined && (
                <div className="flex gap-3">
                  <MetadataLabel icon={HistoryIcon}>Recent</MetadataLabel>
                  <dd>{formatDownloads(record.downloads.recent)}</dd>
                </div>
              )}
              {homepages.map((url) => (
                <div key={url} className="flex gap-3">
                  <MetadataLabel icon={HouseIcon}>Homepage</MetadataLabel>
                  <dd>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all underline"
                    >
                      {url}
                    </a>
                  </dd>
                </div>
              ))}
              {otherLinks.map(([kind, url]) => (
                <div key={kind} className="flex gap-3">
                  <MetadataLabel icon={linkIcons[kind] ?? LinkIcon}>
                    {kind}
                  </MetadataLabel>
                  <dd>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all underline"
                    >
                      {url}
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {versions && versions.length > 0 && (
          <section>
            <Collapsible>
              <CollapsibleTrigger className="group flex items-center gap-1 text-sm font-medium hover:text-foreground">
                Versions ({versions.length})
                <ChevronDownIcon className="transition-transform group-data-[panel-open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="mt-3 flex max-h-64 flex-col gap-1 overflow-y-auto text-sm">
                  {versions.map((version) => (
                    <li key={version.num} className="flex items-center gap-3">
                      <span
                        className={
                          version.num === record.version
                            ? "font-medium"
                            : undefined
                        }
                      >
                        {version.num}
                      </span>
                      {version.num === record.version && (
                        <Badge variant="secondary">current</Badge>
                      )}
                      {version.created_at && (
                        <span className="text-muted-foreground">
                          {version.created_at.slice(0, 10)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </section>
        )}

        <section aria-labelledby="readme-heading">
          <Separator className="mb-6" />
          <h2 id="readme-heading" className="text-lg font-medium">
            Readme
          </h2>
          {readmeHtml ? (
            <article
              className="readme mt-4"
              dangerouslySetInnerHTML={{ __html: readmeHtml }}
            />
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Readme unavailable for this package.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
