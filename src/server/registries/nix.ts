import type { NixRow } from "@/server/nix/dump.ts"
import type { NixIndex } from "@/server/nix/store.ts"
import type { PackageSummary } from "@/shared/registry.ts"

import type { RegistryAdapter } from "./types.ts"

const SEARCH_SIZE = 20
// An attribute path: dot-separated names of letters, digits, `_`, `-` and
// `'`, as nixpkgs uses them (e.g. "python313Packages.requests").
const ATTR_PATH = /^[\w'-]+(?:\.[\w'-]+)*$/u
const ATTR_MAX = 200

function summary(row: NixRow): PackageSummary {
  return {
    description: row.description,
    // The dump has no download counts, repository or release dates.
    downloads: null,
    homepage: row.homepage,
    install: `nix-shell -p ${row.attr}`,
    license: row.license,
    name: row.attr,
    registry: "nix",
    releasedAt: null,
    repository: null,
    version: row.version,
  }
}

// Searches the nix index (Postgres in production), filled from the channel
// dump by scripts/ingest-nix.ts. It reads no registry at request time, so
// it skips the shared cache.
function createNixAdapter(index: NixIndex): RegistryAdapter {
  return {
    isPackageName: (name) => name.length <= ATTR_MAX && ATTR_PATH.test(name),
    localIndex: true,
    package: async (name) => {
      const row = await index.get(name)
      return row === null ? null : summary(row)
    },
    registry: "nix",
    search: async (query) => {
      const rows = await index.search(query, SEARCH_SIZE)
      return rows.map((row) => summary(row))
    },
  }
}

export { createNixAdapter }
