import type { PackageRecord, Registry } from "@/server/registries/record"

import { searchCrates } from "@/server/registries/crates"
import { searchNix, type NixChannel } from "@/server/registries/nix"
import { searchNpm } from "@/server/registries/npm"

export const PAGE_SIZE = 25

export const REGISTRIES: { id: Registry; label: string }[] = [
  { id: "npm", label: "npm" },
  { id: "crates", label: "crates.io" },
  { id: "nix", label: "nixpkgs" },
]

export type SearchResult = {
  records: PackageRecord[]
  degraded?: boolean
}

export async function searchRegistry(input: {
  registry: Registry
  q: string
  offset?: number
  channel?: NixChannel
}): Promise<SearchResult> {
  const { registry, q, offset, channel } = input
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
    default:
      throw new Error("unknown registry")
  }
}
