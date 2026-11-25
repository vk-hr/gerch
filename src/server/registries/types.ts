import type { PackageSummary, Registry } from "@/shared/registry.ts"

interface RegistryAdapter {
  registry: Registry
  search: (query: string) => Promise<PackageSummary[]>
  // One package by its exact name, or null when the registry has none.
  package: (name: string) => Promise<PackageSummary | null>
  // Whether `name` can name a package at all. Other names are reported
  // missing without a request or a cache row.
  isPackageName: (name: string) => boolean
}

export type { RegistryAdapter }
