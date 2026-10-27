import type { PackageRecord } from "@/server/registries/record"

import { cratesPackage } from "@/server/registries/crates"
import { searchNix } from "@/server/registries/nix"
import { npmPackage } from "@/server/registries/npm"
import { z } from "zod"

const registrySchema = z.enum(["npm", "crates", "nix"])

export type PackageDetail = {
  record: PackageRecord
  degraded?: boolean
}

export async function loadPackage(
  registryParam: string,
  name: string
): Promise<PackageDetail> {
  const registry = registrySchema.parse(registryParam)
  switch (registry) {
    case "npm": {
      const detail = await npmPackage({ data: name })
      return { record: detail.record }
    }
    case "crates": {
      const detail = await cratesPackage({ data: name })
      return { record: detail.record }
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
}
