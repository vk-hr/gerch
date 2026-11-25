import { useSuspenseQuery } from "@tanstack/react-query"

import { SearchFailed } from "@/components/search/search-failed.tsx"
import { packageQuery } from "@/lib/package.ts"
import { REGISTRY_LABELS } from "@/shared/registry.ts"
import type { Registry } from "@/shared/registry.ts"

import { PackageCard } from "./package-card.tsx"

function PackageDetails({
  name,
  registry,
}: {
  name: string
  registry: Registry
}) {
  const { data, isFetching, refetch } = useSuspenseQuery(
    packageQuery(registry, name)
  )
  if (data.status === "found") {
    return <PackageCard summary={data.summary} />
  }
  if (data.status === "missing") {
    return (
      <p className="text-sm text-muted-foreground">
        {REGISTRY_LABELS[registry]} has no package named {name}.
      </p>
    )
  }
  return (
    <SearchFailed
      message={data.message}
      onRetry={() => {
        void refetch()
      }}
      retrying={isFetching}
    />
  )
}

export { PackageDetails }
