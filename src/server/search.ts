import type { PackageRecord } from "@/server/registries/record"

import { NIX_CHANNELS } from "@/lib/nix-channel"
import { searchCrates } from "@/server/registries/crates"
import { searchNix } from "@/server/registries/nix"
import { searchNpm } from "@/server/registries/npm"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

export type SearchResult = {
  records: PackageRecord[]
  degraded?: boolean
}

export const searchPackages = createServerFn({ method: "GET" })
  .validator(
    z.object({
      registry: z.enum(["npm", "crates", "nix"]),
      q: z.string().min(1),
      offset: z.number().int().min(0).optional(),
      channel: z.enum(NIX_CHANNELS).optional(),
    })
  )
  .handler(async ({ data }): Promise<SearchResult> => {
    const { registry, q, offset, channel } = data
    switch (registry) {
      case "npm":
        return { records: await searchNpm({ data: { q, offset } }) }
      case "crates":
        return { records: await searchCrates({ data: { q, offset } }) }
      case "nix": {
        const result = await searchNix({ data: { q, channel, offset } })
        return result.ok
          ? { records: result.records }
          : { records: [], degraded: true }
      }
    }
  })
