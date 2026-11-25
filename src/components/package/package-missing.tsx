import { useParams } from "@tanstack/react-router"

import { isRegistry, REGISTRY_LABELS } from "@/shared/registry.ts"

import { PackageLayout } from "./package-layout.tsx"

// The not-found state of /p/$registry/$name: an unknown registry or package.
function PackageMissing() {
  const { name = "", registry = "" } = useParams({ strict: false })
  return (
    <PackageLayout>
      <p className="text-sm text-muted-foreground">
        {isRegistry(registry)
          ? `${REGISTRY_LABELS[registry]} has no package named ${name}.`
          : "Not found."}
      </p>
    </PackageLayout>
  )
}

export { PackageMissing }
