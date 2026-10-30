import { store } from "@/server/pin-store.server"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

const registrySchema = z.enum(["npm", "crates", "nix"])

const pinSchema = z.object({
  registry: registrySchema,
  name: z.string().min(1),
})

export const listPins = createServerFn({ method: "GET" }).handler(async () =>
  store.list()
)

export const addPin = createServerFn({ method: "POST" })
  .validator(pinSchema)
  .handler(async ({ data }) => {
    store.add(data.registry, data.name)
    return store.list()
  })

export const removePin = createServerFn({ method: "POST" })
  .validator(pinSchema)
  .handler(async ({ data }) => {
    store.remove(data.registry, data.name)
    return store.list()
  })
