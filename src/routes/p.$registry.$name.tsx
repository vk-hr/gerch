import { createFileRoute, notFound } from "@tanstack/react-router"

import { PackageMissing } from "@/components/package/package-missing.tsx"
import { PackagePage } from "@/components/package/package-page.tsx"
import { packageQuery } from "@/lib/package.ts"
import { isAvailable, isRegistry } from "@/shared/registry.ts"

// The CDN keeps package pages for an hour (docs/spec.md, "Cache").
const PAGE_CACHE = "public, s-maxage=3600, stale-while-revalidate=86400"

export const Route = createFileRoute("/p/$registry/$name")({
  loader: async ({ context, params }) => {
    const { name, registry } = params
    if (!isRegistry(registry)) {
      throw notFound()
    }
    if (!isAvailable(registry)) {
      return { cacheable: true }
    }
    const result = await context.queryClient.query(packageQuery(registry, name))
    if (result.status === "missing") {
      throw notFound()
    }
    return { cacheable: result.status === "found" }
  },
  headers: ({ loaderData }) => ({
    "cache-control": loaderData?.cacheable === true ? PAGE_CACHE : "no-store",
  }),
  head: ({ params }) => ({ meta: [{ title: `${params.name} · gerch` }] }),
  component: PackageRoute,
  notFoundComponent: PackageMissing,
})

function PackageRoute() {
  const { name, registry } = Route.useParams()
  return isRegistry(registry) ? (
    <PackagePage name={name} registry={registry} />
  ) : null
}
