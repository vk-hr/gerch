import { Search } from "lucide-react"
import type { ChangeEvent, KeyboardEvent, RefObject } from "react"

import type { Combobox } from "@/components/suggestions/use-combobox.ts"
import { joinPrefix } from "@/shared/query.ts"
import type { Registry } from "@/shared/registry.ts"

import { PrefixChip } from "./prefix-chip.tsx"

const PLACEHOLDER =
  "Search npm, crates.io, nixpkgs — npm:zod, crate:serde, nix:ripgrep"

interface FieldProps {
  box: RefObject<HTMLInputElement | null>
  combobox: Combobox
  onChange: (value: string) => void
  prefix: Registry | null
  rest: string
}

// Typing edits the text after the chip; Backspace on empty text removes it.
function fieldHandlers({ combobox, onChange, prefix, rest }: FieldProps) {
  return {
    handleBlur: () => {
      combobox.close()
    },
    handleChange: (event: ChangeEvent<HTMLInputElement>) => {
      onChange(joinPrefix(prefix, event.target.value))
      combobox.reopen()
    },
    handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Backspace" && rest === "" && prefix !== null) {
        event.preventDefault()
        onChange("")
      }
    },
    handleRemove: () => {
      onChange(rest)
    },
  }
}

// The visible box: a prefix chip, if any, and the text after it.
function SearchField(props: FieldProps) {
  const { box, combobox, prefix, rest } = props
  const handlers = fieldHandlers(props)
  const active = combobox.shown && combobox.active >= 0
  return (
    <label className="flex h-10 items-center gap-2 rounded-xl border border-input bg-background px-3 text-sm focus-within:ring-3 focus-within:ring-ring/40">
      <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      {prefix === null ? null : (
        <PrefixChip onRemove={handlers.handleRemove} prefix={prefix} />
      )}
      <input
        aria-activedescendant={
          active ? combobox.optionId(combobox.active) : undefined
        }
        aria-autocomplete="list"
        aria-controls={combobox.listId}
        aria-expanded={combobox.shown}
        aria-label="Search packages"
        autoComplete="off"
        className="h-full min-w-0 flex-1 bg-transparent outline-none"
        onBlur={handlers.handleBlur}
        onChange={handlers.handleChange}
        onKeyDown={handlers.handleKeyDown}
        placeholder={prefix === null ? PLACEHOLDER : `Search ${prefix}`}
        ref={box}
        role="combobox"
        spellCheck={false}
        type="search"
        value={rest}
      />
    </label>
  )
}

export { SearchField }
