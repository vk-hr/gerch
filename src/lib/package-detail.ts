import type { PackageRecord } from "@/server/registries/record"

export function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return String(count)
}

export function installCommand(record: PackageRecord): string | undefined {
  switch (record.registry) {
    case "npm":
      return `npm install ${record.name}`
    case "crates":
      return `cargo add ${record.name}`
    case "nix":
      return record.name
        ? `nix profile install nixpkgs#${record.name}`
        : undefined
  }
}

export function packageHomepages(record: PackageRecord): string[] {
  return (
    record.homepages ?? (record.links.homepage ? [record.links.homepage] : [])
  )
}

export function packageLicenses(record: PackageRecord): string[] {
  return record.licenses ?? (record.license ? [record.license] : [])
}
