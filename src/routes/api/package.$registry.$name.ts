import { createFileRoute } from "@tanstack/react-router"

import { serverContext } from "@/server/context.ts"
import { handlePackage } from "@/server/package.ts"

export const Route = createFileRoute("/api/package/$registry/$name")({
  server: {
    handlers: {
      GET: async ({ params }) =>
        handlePackage(params.registry, params.name, serverContext()),
    },
  },
})
