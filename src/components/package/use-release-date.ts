import { useQueryClient } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"

import type { Registry } from "@/shared/registry.ts"

import { cachedReleaseDate } from "./release-date.ts"

// The release date from a cached search result. The server and the
// hydrating render see none, so markup matches; it appears once the client
// cache has it.
function useCachedReleaseDate(registry: Registry, name: string) {
  const queryClient = useQueryClient()
  return useSyncExternalStore(
    (listener) => queryClient.getQueryCache().subscribe(listener),
    () => cachedReleaseDate(queryClient, registry, name),
    () => null
  )
}

export { useCachedReleaseDate }
