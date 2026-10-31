export type Registry = "npm" | "crates" | "nix"

export type PackageLinks = Partial<
  Record<
    "registry" | "homepage" | "repository" | "documentation" | "issues",
    string
  >
>

export type PackageRecord = {
  registry: Registry
  name: string
  version?: string
  description?: string
  license?: string
  licenses?: string[]
  homepages?: string[]
  links: PackageLinks
  downloads?: { monthly?: number; recent?: number }
}
