import { QueryClient } from "@tanstack/react-query"
import { createRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"

import { PERSIST_MAX_AGE_MS } from "./client/query-persister.ts"
import { PersistQueryCache } from "./components/persist-query-cache.tsx"
import { routeTree } from "./routeTree.gen"

const PRELOAD_DELAY_MS = 50

export function getRouter() {
  // A failed search shows its error and a Retry button at once instead of
  // retrying quietly with backoff. In the browser, searches stay in memory as
  // long as the persisted cache keeps them, or the next save would drop them.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime:
          typeof document === "undefined" ? undefined : PERSIST_MAX_AGE_MS,
        retry: false,
      },
    },
  })
  const router = createRouter({
    Wrap: PersistQueryCache,
    context: { queryClient },
    defaultPreload: "intent",
    defaultPreloadDelay: PRELOAD_DELAY_MS,
    defaultPreloadStaleTime: 0,
    routeTree,
    scrollRestoration: true,
  })
  setupRouterSsrQueryIntegration({ queryClient, router })
  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
