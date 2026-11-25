import { History, Package, Pin } from "lucide-react"

import { REGISTRY_LABELS } from "@/shared/registry.ts"

import type { Suggestion } from "./suggest.ts"
import type { Combobox } from "./use-combobox.ts"

const KIND = {
  history: { Icon: History, label: "Recent" },
  pin: { Icon: Pin, label: "Pinned" },
  result: { Icon: Package, label: "Result" },
} as const

// The combobox's popup. Options never take focus: the search box keeps it,
// and the keyboard moves `aria-activedescendant` (docs/decisions.md D27).
function SuggestionList({
  combobox,
  suggestions,
}: {
  combobox: Combobox
  suggestions: readonly Suggestion[]
}) {
  return (
    <div
      aria-label="Suggestions"
      className="absolute inset-x-0 top-full z-10 mt-1 grid gap-0.5 rounded-xl border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md"
      id={combobox.listId}
      role="listbox"
    >
      {suggestions.map((suggestion, index) => {
        const { Icon, label } = KIND[suggestion.kind]
        const registry =
          suggestion.registry === null
            ? "all registries"
            : REGISTRY_LABELS[suggestion.registry]
        return (
          <div
            aria-selected={index === combobox.active}
            className="flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60 aria-selected:bg-muted"
            data-kind={suggestion.kind}
            id={combobox.optionId(index)}
            key={`${suggestion.kind} ${suggestion.query}`}
            onMouseDown={(event) => {
              // Choosing on press keeps focus in the search box.
              event.preventDefault()
              combobox.choose(suggestion)
            }}
            role="option"
            tabIndex={-1}
          >
            <Icon
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="truncate font-heading">{suggestion.name}</span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {`${registry} · ${label}`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export { SuggestionList }
