import { Suspense } from "react"

import { REGISTRY_LABELS } from "@/shared/registry.ts"
import type { Registry } from "@/shared/registry.ts"

import { Results } from "./results.tsx"
import { ResultsSkeleton } from "./results-skeleton.tsx"

// One registry's results. Each section loads and fails on its own, so a slow
// or failing registry never blocks the others.
function RegistrySection({
  registry,
  text,
}: {
  registry: Registry
  text: string
}) {
  const label = REGISTRY_LABELS[registry]
  return (
    <section aria-label={label} className="grid gap-3">
      <h2 className="font-heading text-sm text-muted-foreground">{label}</h2>
      <Suspense fallback={<ResultsSkeleton />}>
        <Results registry={registry} text={text} />
      </Suspense>
    </section>
  )
}

export { RegistrySection }
