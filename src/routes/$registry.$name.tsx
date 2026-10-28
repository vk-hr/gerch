import { loadPackage } from "@/lib/packages"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/$registry/$name")({
  loader: ({ params }) =>
    loadPackage(params.registry, decodeURIComponent(params.name)),
  component: PackagePage,
})

function PackagePage() {
  const { record, readmeHtml, versions, degraded } = Route.useLoaderData()
  const links = Object.entries(record.links).filter(([, url]) => url)

  return (
    <div className="mx-auto max-w-3xl p-6">
      <p className="text-xs text-muted-foreground uppercase">
        {record.registry}
      </p>
      <h1 className="mt-1 text-2xl font-semibold break-all">{record.name}</h1>
      {record.version && (
        <p className="text-muted-foreground">{record.version}</p>
      )}
      {record.description && <p className="mt-3">{record.description}</p>}
      {record.license && (
        <p className="mt-2 text-sm text-muted-foreground">
          License: {record.license}
        </p>
      )}
      {degraded && (
        <p role="status" className="mt-3 text-sm">
          Package metadata is unavailable right now.
        </p>
      )}
      <dl className="mt-6 space-y-2">
        {links.map(([kind, url]) => (
          <div key={kind} className="flex gap-2 text-sm">
            <dt className="w-28 shrink-0 text-muted-foreground">{kind}</dt>
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

      {versions && versions.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            {versions.length} version{versions.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-2 space-y-1 text-sm">
            {versions.map((version) => (
              <li key={version.num} className="flex gap-3">
                <span
                  className={
                    version.num === record.version ? "font-medium" : ""
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
        </details>
      )}

      {readmeHtml && (
        <article
          className="mt-8 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: readmeHtml }}
        />
      )}
    </div>
  )
}
