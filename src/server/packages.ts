import type { PackageRecord } from "@/server/registries/record"

import { cratesPackage } from "@/server/registries/crates"
import { searchNix } from "@/server/registries/nix"
import { npmPackage } from "@/server/registries/npm"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

const registrySchema = z.enum(["npm", "crates", "nix"])

export type PackageDetail = {
  record: PackageRecord
  readmeHtml?: string
  versions?: { num: string; created_at?: string }[]
  degraded?: boolean
}

export const getPackage = createServerFn({ method: "GET" })
  .validator(z.object({ registry: z.string(), name: z.string().min(1) }))
  .handler(async ({ data }): Promise<PackageDetail> => {
    const registry = registrySchema.parse(data.registry)
    const name = data.name
    switch (registry) {
      case "npm": {
        const detail = await npmPackage({ data: name })
        return { record: detail.record, readmeHtml: detail.readmeHtml }
      }
      case "crates": {
        const detail = await cratesPackage({ data: name })
        return {
          record: detail.record,
          readmeHtml: detail.readmeHtml,
          versions: detail.record.versions,
        }
      }
      case "nix": {
        const result = await searchNix({ data: { q: name } })
        const record = result.ok
          ? result.records.find((candidate) => candidate.name === name)
          : undefined
        return {
          record: record ?? { registry: "nix", name, links: {} },
          degraded: !result.ok || !record,
        }
      }
      default:
        throw new Error("unknown registry")
    }
  })
