import { NIX_CHANNELS } from "@/lib/nix-channel"
import { searchNixHandler } from "@/server/registries/nix.server"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export const searchNix = createServerFn({ method: "GET" })
  .validator(
    z.object({
      q: z.string().min(1),
      channel: z.enum(NIX_CHANNELS).optional(),
      offset: z.number().int().min(0).optional(),
    })
  )
  .handler(async ({ data }) =>
    searchNixHandler(data.q, data.channel, data.offset)
  )
