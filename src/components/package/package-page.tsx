import { Suspense } from "react"

import { ResultsSkeleton } from "@/components/search/results-skeleton.tsx"
import { useInteractiveMarker } from "@/components/use-interactive-marker.ts"
import type { Registry } from "@/shared/registry.ts"

import { PackageDetails } from "./package-details.tsx"
import { PackageLayout } from "./package-layout.tsx"

function PackagePage({ name, registry }: { name: string; registry: Registry }) {
  useInteractiveMarker()
  return (
    <PackageLayout>
      <Suspense fallback={<ResultsSkeleton />}>
        <PackageDetails name={name} registry={registry} />
      </Suspense>
    </PackageLayout>
  )
}

export { PackagePage }
