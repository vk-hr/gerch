import { queryOptions } from "@tanstack/react-query"
import { createServerFn } from "@tanstack/react-start"

import { isRegistry, REGISTRY_LABELS } from "@/shared/registry.ts"
import type { PackageSummary, Registry } from "@/shared/registry.ts"

type PackageResult =
  | { status: "found"; summary: PackageSummary }
  | { status: "missing" }
  | { status: "failed"; message: string }

interface PackageInput {
  registry: Registry
  name: string
}

const STALE_MS = 300_000

function validatePackageInput(input: unknown): PackageInput {
  if (
    typeof input === "object" &&
    input !== null &&
    "registry" in input &&
    typeof input.registry === "string" &&
    isRegistry(input.registry) &&
    "name" in input &&
    typeof input.name === "string"
  ) {
    return { name: input.name, registry: input.registry }
  }
  throw new TypeError("expected { registry, name }")
}

// One package through the shared cache. Like search, failures come back as
// data, and only the browser's own call gets the CDN cache headers.
const lookUpPackage = createServerFn({ method: "GET" })
  .validator(validatePackageInput)
  .handler(async ({ data }): Promise<PackageResult> => {
    const [
      { getRequestHeader, setResponseHeaders },
      { serverContext },
      { packageCdnCache, runPackage },
    ] = await Promise.all([
      import("@tanstack/react-start/server"),
      import("@/server/context.ts"),
      import("@/server/package.ts"),
    ])
    const outcome = await runPackage(serverContext(), data.registry, data.name)
    if (getRequestHeader("x-tsr-serverFn") === "true") {
      const cache =
        outcome.status === "found" ? packageCdnCache(data.registry) : "no-store"
      setResponseHeaders(new Headers({ "cache-control": cache }))
    }
    return outcome.status === "found"
      ? { status: "found", summary: outcome.summary }
      : outcome
  })

async function fetchPackage(
  registry: Registry,
  name: string
): Promise<PackageResult> {
  try {
    return await lookUpPackage({ data: { name, registry } })
  } catch {
    return {
      message: `${REGISTRY_LABELS[registry]} is unavailable`,
      status: "failed",
    }
  }
}

function packageQuery(registry: Registry, name: string) {
  return queryOptions({
    queryFn: async () => fetchPackage(registry, name),
    queryKey: ["package", registry, name],
    // A failure is stale at once, so coming back to it loads again.
    staleTime: ({ state }) => (state.data?.status === "failed" ? 0 : STALE_MS),
  })
}

export { packageQuery }
export type { PackageResult }
