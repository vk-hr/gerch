import { isRegistry, REGISTRIES } from "./registry.ts"
import type { Registry } from "./registry.ts"

interface ParsedQuery {
  // The registry a prefix picked, or null to search every registry.
  prefix: Registry | null
  registries: Registry[]
  text: string
}

const PREFIX = /^(?<name>[a-z]+):\s*(?<rest>.*)$/iu

// "npm:zod" searches npm only; "zod" searches every registry. An unknown
// prefix such as "pypi:requests" is kept as search text.
function parseQuery(input: string): ParsedQuery {
  const trimmed = input.trim()
  const match = PREFIX.exec(trimmed)
  const name = match?.groups?.name?.toLowerCase() ?? ""
  if (isRegistry(name)) {
    return {
      prefix: name,
      registries: [name],
      text: match?.groups?.rest?.trim() ?? "",
    }
  }
  return { prefix: null, registries: [...REGISTRIES], text: trimmed }
}

export { parseQuery }
export type { ParsedQuery }
