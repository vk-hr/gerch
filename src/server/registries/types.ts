import type { PackageSummary, Registry } from "@/shared/registry.ts"

interface RegistryAdapter {
  registry: Registry
  search: (query: string) => Promise<PackageSummary[]>
  // One package by its exact name, or null when the registry has none.
  package: (name: string) => Promise<PackageSummary | null>
}

export type { RegistryAdapter }
