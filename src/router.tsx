import { QueryClient } from "@tanstack/react-query"
import { createRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"

import { routeTree } from "./routeTree.gen"

const PRELOAD_DELAY_MS = 50

export function getRouter() {
  // A failed search shows its error and a Retry button at once instead of
  // retrying quietly with backoff.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createRouter({
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
