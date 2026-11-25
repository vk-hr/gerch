import { useMatch } from "@tanstack/react-router"
import { useEffect, useRef } from "react"

import { updateClientState } from "@/client/use-client-state.ts"
import { isRegistry } from "@/shared/registry.ts"

import { followFirstRoute, followRoute } from "./tab-list.ts"
import type { TabContent } from "./tab-list.ts"

function content(
  query: string | undefined,
  registry: string | undefined,
  name: string | undefined
): TabContent | null {
  if (query !== undefined) {
    return { kind: "search", query }
  }
  if (registry !== undefined && name !== undefined && isRegistry(registry)) {
    return { kind: "package", name, registry }
  }
  return null
}

// Keeps the active tab in step with routes the tab actions didn't start:
// the first load, back, forward and links.
function useFollowRoute() {
  const query = useMatch({
    from: "/",
    select: (match) => match.search.q ?? "",
    shouldThrow: false,
  })
  const packageRoute = {
    from: "/p/$registry/$name",
    shouldThrow: false,
  } as const
  const registry = useMatch({
    ...packageRoute,
    select: (match) => match.params.registry,
  })
  const name = useMatch({
    ...packageRoute,
    select: (match) => match.params.name,
  })
  const followed = useRef(false)
  useEffect(() => {
    const shown = content(query, registry, name)
    if (shown === null) {
      return
    }
    const follow = followed.current ? followRoute : followFirstRoute
    followed.current = true
    updateClientState((state) => follow(state, shown, crypto.randomUUID()))
  }, [query, registry, name])
}

export { useFollowRoute }
