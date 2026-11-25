import { createFileRoute } from "@tanstack/react-router"

import { serverContext } from "@/server/context.ts"
import { handleVitals } from "@/server/vitals.ts"

export const Route = createFileRoute("/api/vitals")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        handleVitals(request, serverContext().vitals),
    },
  },
})
