import { isRegistry } from "@/shared/registry.ts"
import type { Registry } from "@/shared/registry.ts"

// The result card that holds focus, or contains it (a link or button inside
// the card). Shortcuts that act on "the selected result" read it.
function focusedResult(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement
    ? document.activeElement.closest<HTMLElement>("[data-result]")
    : null
}

interface FocusedPackage {
  registry: Registry
  name: string
  install: string
}

function focusedPackage(): FocusedPackage | null {
  const card = focusedResult()
  const { install, name, registry } = card?.dataset ?? {}
  if (
    install === undefined ||
    name === undefined ||
    registry === undefined ||
    !isRegistry(registry)
  ) {
    return null
  }
  return { install, name, registry }
}

export { focusedPackage, focusedResult }
export type { FocusedPackage }
