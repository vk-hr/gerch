import { isRegistry } from "@/shared/registry.ts"
import type { Registry } from "@/shared/registry.ts"

// The result card that holds focus, or contains it (a link or button inside
// the card). Shortcuts that act on "the selected result" read it.
function focusedResult(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement
    ? document.activeElement.closest<HTMLElement>("[data-result]")
    : null
}

// True while focus is inside a dialog: page shortcuts leave it alone.
function focusInDialog(): boolean {
  return (
    document.activeElement instanceof Element &&
    document.activeElement.closest('dialog[open], [role="dialog"]') !== null
  )
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

export { focusedPackage, focusedResult, focusInDialog }
export type { FocusedPackage }
