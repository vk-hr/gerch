import { createFileRoute } from "@tanstack/react-router"

import { serverContext } from "@/server/context.ts"
import { handleSearch } from "@/server/search.ts"

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        handleSearch(new URL(request.url), serverContext()),
    },
  },
})
