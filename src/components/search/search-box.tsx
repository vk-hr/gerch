import type { RefObject } from "react"

import { SuggestionList } from "@/components/suggestions/suggestion-list.tsx"
import { useCombobox } from "@/components/suggestions/use-combobox.ts"
import { useSearchHistory } from "@/components/suggestions/use-search-history.ts"
import { useSuggestions } from "@/components/suggestions/use-suggestions.ts"
import { splitPrefix } from "@/shared/query.ts"

import { SearchField } from "./search-field.tsx"

// The search input, a combobox over suggestions. A recognized prefix shows
// as a chip; `value` stays the raw query, prefix included (e.g. "npm:zod").
function SearchBox({
  onChange,
  ref,
  value,
}: {
  onChange: (value: string) => void
  ref: RefObject<HTMLInputElement | null>
  value: string
}) {
  const { prefix, rest } = splitPrefix(value)
  const suggestions = useSuggestions(value)
  const combobox = useCombobox(ref, suggestions, onChange)
  useSearchHistory()
  return (
    <div className="relative flex-1">
      <SearchField
        box={ref}
        combobox={combobox}
        onChange={onChange}
        prefix={prefix}
        rest={rest}
      />
      {combobox.shown ? (
        <SuggestionList combobox={combobox} suggestions={suggestions} />
      ) : null}
    </div>
  )
}

export { SearchBox }
