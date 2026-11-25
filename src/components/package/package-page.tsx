import { Suspense } from "react"

import { ResultsSkeleton } from "@/components/search/results-skeleton.tsx"
import { useInteractiveMarker } from "@/components/use-interactive-marker.ts"
import { isAvailable, REGISTRY_LABELS } from "@/shared/registry.ts"
import type { Registry } from "@/shared/registry.ts"

import { PackageDetails } from "./package-details.tsx"
import { PackageLayout } from "./package-layout.tsx"

function PackagePage({ name, registry }: { name: string; registry: Registry }) {
  useInteractiveMarker()
  return (
    <PackageLayout>
      {isAvailable(registry) ? (
        <Suspense fallback={<ResultsSkeleton />}>
          <PackageDetails name={name} registry={registry} />
        </Suspense>
      ) : (
        <p className="text-sm text-muted-foreground">
          {REGISTRY_LABELS[registry]} packages are coming soon.
        </p>
      )}
    </PackageLayout>
  )
}

export { PackagePage }
