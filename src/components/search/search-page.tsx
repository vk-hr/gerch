import { useRef } from "react"

import { useInteractiveMarker } from "@/components/use-interactive-marker.ts"
import { parseQuery } from "@/shared/query.ts"

import { RegistrySection } from "./registry-section.tsx"
import { SearchBox } from "./search-box.tsx"
import { useOpenHotkeys } from "./use-open-hotkeys.ts"
import { useQueryInput } from "./use-query-input.ts"
import { escape, useSearchHotkeys } from "./use-search-hotkeys.ts"

function SearchPage({ query }: { query: string }) {
  const searchBox = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLElement>(null)
  const [input, change] = useQueryInput(query)
  const parsed = parseQuery(query)
  useSearchHotkeys(searchBox, list, () => {
    escape(searchBox.current, input, () => {
      change("")
    })
  })
  useOpenHotkeys(list)
  useInteractiveMarker()

  return (
    <main className="mx-auto grid max-w-3xl gap-6 p-4 sm:p-6" ref={list}>
      <header className="flex items-center gap-3">
        <span className="font-heading text-lg font-medium">gerch</span>
        <SearchBox onChange={change} ref={searchBox} value={input} />
      </header>
      {parsed.text === "" ? (
        <p className="text-sm text-muted-foreground">
          Press <kbd className="font-heading">/</kbd> to search. Prefix a
          registry to search only it.
        </p>
      ) : (
        parsed.registries.map((registry) => (
          <RegistrySection
            key={registry}
            registry={registry}
            text={parsed.text}
          />
        ))
      )}
    </main>
  )
}

export { SearchPage }
