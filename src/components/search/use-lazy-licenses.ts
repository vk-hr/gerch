import { useQueries, useQueryClient } from "@tanstack/react-query"
import type { QueryClient } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"

import { packageQuery } from "@/lib/package.ts"
import type { PackageSummary } from "@/shared/registry.ts"

type Lookup = ReturnType<typeof packageQuery>

// How many lookups, from the first, already have an answer in the cache.
function answeredRun(queryClient: QueryClient, lookups: readonly Lookup[]) {
  const pending = lookups.findIndex(
    (lookup) => queryClient.getQueryData(lookup.queryKey) === undefined
  )
  return pending === -1 ? lookups.length : pending
}

// Search results from crates.io carry no license; the package endpoint has it
// (D13). Each missing license loads from there, one at a time in result
// order, so one search page queues at most one request behind crates.io's
// 1 req/s limit. A license already in the client cache shows at once. The
// server and the hydrating render start none, so markup matches.
function useLazyLicenses(
  results: readonly PackageSummary[]
): ReadonlyMap<string, string> {
  const queryClient = useQueryClient()
  const lookups = results
    .filter((result) => result.license === null && result.registry === "crate")
    .map((result) => packageQuery(result.registry, result.name))
  const answered = useSyncExternalStore(
    (listener) => queryClient.getQueryCache().subscribe(listener),
    () => answeredRun(queryClient, lookups),
    () => 0
  )
  const found = useQueries({
    // Each lookup is a fresh object from packageQuery, so it's set in place.
    queries: lookups.map((lookup, index) =>
      Object.assign(lookup, { enabled: index <= answered })
    ),
  })
  const licenses = new Map<string, string>()
  for (const { data } of found) {
    if (data?.status === "found" && data.summary.license !== null) {
      licenses.set(data.summary.name, data.summary.license)
    }
  }
  return licenses
}

export { useLazyLicenses }
