import type { Registry } from "@/server/registries/record"

export const PAGE_SIZE = 25

export const REGISTRIES: { id: Registry; label: string }[] = [
  { id: "npm", label: "npm" },
  { id: "crates", label: "crates.io" },
  { id: "nix", label: "nixpkgs" },
]
