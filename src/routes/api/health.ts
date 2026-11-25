import { createFileRoute } from "@tanstack/react-router"

import { serverContext } from "@/server/context.ts"
import { handleHealth } from "@/server/health.ts"

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const { nixState, refreshFailures } = serverContext()
        return handleHealth({ nixState, now: Date.now, refreshFailures })
      },
    },
  },
})
