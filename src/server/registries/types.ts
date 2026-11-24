import type { PackageSummary, Registry } from "@/shared/registry.ts"

interface RegistryAdapter {
  registry: Registry
  search: (query: string) => Promise<PackageSummary[]>
}

export type { RegistryAdapter }
