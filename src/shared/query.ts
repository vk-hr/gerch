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

const LEADING_PREFIX = /^(?<name>[a-z]+):/iu

// Splits a recognized prefix off the raw query and keeps the rest exactly as
// typed, so the search box can show the prefix as a chip.
function splitPrefix(raw: string): { prefix: Registry | null; rest: string } {
  const start = raw.trimStart()
  const match = LEADING_PREFIX.exec(start)
  const name = match?.groups?.name?.toLowerCase() ?? ""
  return isRegistry(name) && match !== null
    ? { prefix: name, rest: start.slice(match[0].length) }
    : { prefix: null, rest: raw }
}

// The raw query for a prefix and the text after it. Text that brings its own
// prefix replaces the chip's.
function joinPrefix(prefix: Registry | null, rest: string): string {
  return prefix === null || splitPrefix(rest).prefix !== null
    ? rest
    : `${prefix}:${rest}`
}

export { joinPrefix, parseQuery, splitPrefix }
export type { ParsedQuery }
