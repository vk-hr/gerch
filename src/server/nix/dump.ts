// Reads the nixpkgs channel dump (packages.json.br) into the rows of the nix
// index. Each package is checked on its own: an odd field reads as missing,
// and an entry without a version is skipped (D30).
import { z } from "zod"

const CHANNEL_URL = "https://channels.nixos.org/nixos-unstable/packages.json.br"

interface NixRow {
  // The attribute path, e.g. "ripgrep" or "python313Packages.requests".
  attr: string
  pname: string
  version: string
  description: string | null
  license: string | null
  homepage: string | null
  mainProgram: string | null
}

const dumpSchema = z.object({ packages: z.record(z.string(), z.unknown()) })
const entrySchema = z.object({
  meta: z
    .object({
      description: z.unknown().optional(),
      homepage: z.unknown().optional(),
      license: z.unknown().optional(),
      mainProgram: z.unknown().optional(),
    })
    .optional(),
  pname: z.unknown().optional(),
  version: z.string().min(1),
})
const simpleLicenseSchema = z.object({
  fullName: z.string().optional(),
  spdxId: z.string().optional(),
})
const compoundLicenseSchema = z.object({
  licenses: z.array(z.unknown()),
  operator: z.string(),
})

function textOf(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null
}

function simpleLicense(value: unknown): string | null {
  if (typeof value === "string") {
    return textOf(value)
  }
  const parsed = simpleLicenseSchema.safeParse(value)
  return parsed.success
    ? (textOf(parsed.data.spdxId) ?? textOf(parsed.data.fullName))
    : null
}

function joined(values: readonly unknown[], separator: string) {
  const names = values
    .map((value) => simpleLicense(value))
    .filter((name) => name !== null)
  return names.length === 0 ? null : names.join(separator)
}

// SPDX ids where nixpkgs has them, else the license's full name ("Unfree").
// A compound license keeps its operator; a plain list of licenses doesn't
// say how they combine, so it is listed with commas.
function licenseOf(value: unknown): string | null {
  if (Array.isArray(value)) {
    return joined(value, ", ")
  }
  const compound = compoundLicenseSchema.safeParse(value)
  if (compound.success) {
    return joined(compound.data.licenses, ` ${compound.data.operator} `)
  }
  return simpleLicense(value)
}

// Some packages list several homepages; the first one is shown.
function homepageOf(value: unknown): string | null {
  const first: unknown = Array.isArray(value) ? value[0] : value
  const text = textOf(first)
  return text !== null && URL.canParse(text) && /^https?:/u.test(text)
    ? text
    : null
}

function nixRow(attr: string, entry: unknown): NixRow | null {
  const parsed = entrySchema.safeParse(entry)
  if (!parsed.success) {
    return null
  }
  const { meta, pname, version } = parsed.data
  return {
    attr,
    description: textOf(meta?.description),
    homepage: homepageOf(meta?.homepage),
    license: licenseOf(meta?.license),
    mainProgram: textOf(meta?.mainProgram),
    pname: textOf(pname) ?? attr,
    version,
  }
}

function nixRows(dump: unknown): NixRow[] {
  return Object.entries(dumpSchema.parse(dump).packages).flatMap(
    ([attr, entry]) => {
      const row = nixRow(attr, entry)
      return row === null ? [] : [row]
    }
  )
}

export { CHANNEL_URL, dumpSchema as nixDumpSchema, nixRows }
export type { NixRow }
