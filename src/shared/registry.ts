// Types shared by the server and the browser. Runtime validation lives in
// src/server/schema.ts so zod stays out of the client bundle.
const REGISTRIES = ["npm", "crate", "nix"] as const

type Registry = (typeof REGISTRIES)[number]

interface PackageSummary {
  registry: Registry
  // For nix, the attribute path, e.g. "ripgrep".
  name: string
  version: string
  // ISO 8601; null where the registry has no release date (nix).
  releasedAt: string | null
  license: string | null
  downloads: { count: number; window: "week" | "90d" } | null
  description: string | null
  repository: string | null
  homepage: string | null
  install: string
}

interface SearchResponse {
  registry: Registry
  query: string
  results: PackageSummary[]
}

// Registries the server can search today; the rest show "coming soon".
const AVAILABLE_REGISTRIES: ReadonlySet<Registry> = new Set(["npm"])

const REGISTRY_LABELS: Record<Registry, string> = {
  crate: "crates.io",
  nix: "nixpkgs",
  npm: "npm",
}

function isAvailable(registry: Registry): boolean {
  return AVAILABLE_REGISTRIES.has(registry)
}

function isRegistry(value: string): value is Registry {
  return REGISTRIES.some((registry) => registry === value)
}

export { isAvailable, isRegistry, REGISTRIES, REGISTRY_LABELS }
export type { PackageSummary, Registry, SearchResponse }
