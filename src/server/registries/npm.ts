import {
  npmPackageHandler,
  searchNpmHandler,
} from "@/server/registries/npm.server"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export const searchNpm = createServerFn({ method: "GET" })
  .validator(
    z.object({
      q: z.string().min(1),
      offset: z.number().int().min(0).optional(),
    })
  )
  .handler(async ({ data }) => searchNpmHandler(data.q, data.offset))

export const npmPackage = createServerFn({ method: "GET" })
  .validator(z.string().min(1))
  .handler(async ({ data }) => npmPackageHandler(data))
