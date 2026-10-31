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
import { useNixChannel } from "@/hooks/use-nix-channel"
import { NIX_CHANNELS } from "@/lib/nix-channel"
import { openTab } from "@/lib/workspace"
import { getPackage } from "@/server/packages"
import {
  createFileRoute,
  notFound,
  type ErrorComponentProps,
} from "@tanstack/react-router"
import { ChevronDownIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react"
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
  errorComponent: PackageError,
})

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

function PackagePage() {
  const { record, readmeHtml, versions, degraded } = Route.useLoaderData()
  const { channel: urlChannel } = Route.useSearch()
  const [savedChannel] = useNixChannel()
  const navigate = Route.useNavigate()
  const links = Object.entries(record.links).filter(([, url]) => url)

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
    <div className="flex flex-col p-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="uppercase">
            {record.registry}
          </Badge>
          {record.version && (
            <Badge variant="secondary">{record.version}</Badge>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-semibold break-all">{record.name}</h1>
        <PinToggle registry={record.registry} name={record.name} />
        {record.description && <p className="mt-3">{record.description}</p>}
        {record.license && (
          <p className="mt-2 text-sm text-muted-foreground">
            License: {record.license}
          </p>
        )}
        {degraded && (
          <Alert className="mt-3">
            <TriangleAlertIcon />
            <AlertDescription>
              Package metadata is unavailable right now.
            </AlertDescription>
          </Alert>
        )}

        {links.length > 0 && (
          <>
            <Separator className="my-6" />
            <dl className="flex flex-col gap-2 text-sm">
              {links.map(([kind, url]) => (
                <div key={kind} className="flex gap-2">
                  <dt className="w-28 shrink-0 text-muted-foreground">
                    {kind}
                  </dt>
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
          </>
        )}

        {versions && versions.length > 0 && (
          <>
            <Separator className="my-6" />
            <Collapsible>
              <CollapsibleTrigger className="group flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                {versions.length} version{versions.length === 1 ? "" : "s"}
                <ChevronDownIcon className="transition-transform group-data-[panel-open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="mt-2 flex flex-col gap-1 text-sm">
                  {versions.map((version) => (
                    <li key={version.num} className="flex gap-3">
                      <span
                        className={
                          version.num === record.version
                            ? "font-medium"
                            : undefined
                        }
                      >
                        {version.num}
                      </span>
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
          </>
        )}

        {readmeHtml && (
          <>
            <Separator className="my-6" />
            <article
              className="text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: readmeHtml }}
            />
          </>
        )}
      </div>
    </div>
  )
}
