import {
  cratesPackageHandler,
  searchCratesHandler,
} from "@/server/registries/crates.server"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export const searchCrates = createServerFn({ method: "GET" })
  .validator(
    z.object({
      q: z.string().min(1),
      offset: z.number().int().min(0).optional(),
    })
  )
  .handler(async ({ data }) => searchCratesHandler(data.q, data.offset))

export const cratesPackage = createServerFn({ method: "GET" })
  .validator(z.string().min(1))
  .handler(async ({ data }) => cratesPackageHandler(data))
