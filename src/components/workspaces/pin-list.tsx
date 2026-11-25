import { useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"
import type { RefObject } from "react"

import type { Workspace } from "@/client/state.ts"

import { cachedResults } from "./cached-results.ts"
import { PinnedCard } from "./pinned-card.tsx"
import { unpin } from "./workspace-actions.ts"
import { freshestSummary } from "./workspaces.ts"

// Removing a pin takes its button away, so focus moves to the next pin's
// button, else the previous one's, else the fallback.
function focusAfterRemoving(
  list: HTMLElement | null,
  index: number,
  fallback: HTMLElement | null
) {
  const buttons = [
    ...(list?.querySelectorAll<HTMLElement>("[data-remove-pin]") ?? []),
  ]
  ;(buttons[index + 1] ?? buttons[index - 1] ?? fallback)?.focus()
}

// A workspace's pins as result cards, each with the newest version the
// search cache holds.
function PinList({
  fallbackFocus,
  workspace,
}: {
  fallbackFocus: RefObject<HTMLElement | null>
  workspace: Workspace
}) {
  const cached = cachedResults(useQueryClient())
  const list = useRef<HTMLUListElement>(null)
  return (
    <ul className="grid gap-3 overflow-y-auto overscroll-contain" ref={list}>
      {workspace.pins.map((pin, index) => (
        <PinnedCard
          key={`${pin.registry}:${pin.name}`}
          onRemove={() => {
            focusAfterRemoving(list.current, index, fallbackFocus.current)
            unpin(workspace.id, pin)
          }}
          summary={freshestSummary(pin, cached)}
          workspaceName={workspace.name}
        />
      ))}
    </ul>
  )
}

export { PinList }
