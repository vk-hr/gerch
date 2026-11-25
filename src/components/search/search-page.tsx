import { useHotkey } from "@tanstack/react-hotkeys"
import { useEffect, useRef, useState } from "react"
import type { RefObject } from "react"

import { useTabActions } from "@/components/tabs/use-tab-actions.ts"
import { useInteractiveMarker } from "@/components/use-interactive-marker.ts"
import { HOTKEYS } from "@/hotkeys.ts"
import { parseQuery } from "@/shared/query.ts"

import { useCopied } from "./copied-context.ts"
import { focusedPackage, focusedResult } from "./focused-result.ts"
import { RegistrySection } from "./registry-section.tsx"
import { SearchBox } from "./search-box.tsx"

const URL_DEBOUNCE_MS = 150

// Moves focus through result cards in page order; up from the first card
// returns to the search box.
function moveFocus(step: 1 | -1, searchBox: HTMLInputElement | null) {
  const cards = [...document.querySelectorAll<HTMLElement>("[data-result]")]
  const current = focusedResult()
  const next = cards[(current === null ? -1 : cards.indexOf(current)) + step]
  if (next === undefined) {
    if (step === -1) {
      searchBox?.focus()
    }
    return
  }
  next.focus()
  next.scrollIntoView({ block: "nearest" })
}

// Escape clears the query, then leaves the search box; from elsewhere it
// returns to the search box.
function escape(
  box: HTMLInputElement | null,
  input: string,
  clear: () => void
) {
  if (document.activeElement === box && input !== "") {
    clear()
  } else if (document.activeElement === box) {
    box?.blur()
  } else {
    box?.focus()
  }
}

function useSearchHotkeys(
  searchBox: RefObject<HTMLInputElement | null>,
  list: RefObject<HTMLElement | null>,
  onEscape: () => void
) {
  const { copy } = useCopied()
  const inputsToo = { ignoreInputs: false } as const
  // Arrow keys are list navigation: they act only inside <main>, from the
  // search box or a card (docs/decisions.md D23).
  const inList = { ignoreInputs: false, target: list } as const
  useHotkey(HOTKEYS.focusSearch.keys, () => searchBox.current?.focus())
  useHotkey(HOTKEYS.focusSearchMod.keys, () => searchBox.current?.focus())
  useHotkey(HOTKEYS.clear.keys, onEscape, inputsToo)
  useHotkey(
    HOTKEYS.next.keys,
    () => {
      moveFocus(1, searchBox.current)
    },
    inList
  )
  useHotkey(
    HOTKEYS.previous.keys,
    () => {
      moveFocus(-1, searchBox.current)
    },
    inList
  )
  useHotkey(
    HOTKEYS.copy.keys,
    () => {
      const selected = focusedPackage()
      if (selected !== null) {
        copy(selected.install)
      }
    },
    inputsToo
  )
}

// Enter opens the focused result in the current tab; Shift+Enter opens it in
// a new tab next to this one and leaves the search, its query and its
// selection, in front (docs/spec.md, flow 4).
function useOpenHotkeys(list: RefObject<HTMLElement | null>) {
  const tabs = useTabActions()
  const inList = { target: list } as const
  useHotkey(
    HOTKEYS.open.keys,
    () => {
      const selected = focusedPackage()
      if (selected !== null) {
        tabs.show({ kind: "package", ...selected })
      }
    },
    inList
  )
  useHotkey(
    HOTKEYS.openInNewTab.keys,
    () => {
      const selected = focusedPackage()
      if (selected !== null) {
        tabs.openNext({ kind: "package", ...selected })
      }
    },
    inList
  )
}

type Timer = ReturnType<typeof setTimeout>

function cancel(pending: RefObject<Timer | null>) {
  if (pending.current !== null) {
    clearTimeout(pending.current)
  }
}

// The search box's text, kept in step with the URL's `q`. Typing writes `q`
// once typing pauses, in the current tab. A `q` that changes from outside
// (back, forward, a tab switch) replaces the text and drops any write still
// waiting, so it never overwrites the history entry the user went to.
function useQueryInput(query: string) {
  const tabs = useTabActions()
  const [input, setInput] = useState(query)
  const written = useRef(query)
  const pending = useRef<Timer>(null)
  useEffect(() => {
    if (query !== written.current) {
      written.current = query
      cancel(pending)
      setInput(query)
    }
  }, [query])
  useEffect(
    () => () => {
      cancel(pending)
    },
    []
  )
  const change = (value: string) => {
    setInput(value)
    cancel(pending)
    pending.current = setTimeout(() => {
      written.current = value
      tabs.show({ kind: "search", query: value }, true)
    }, URL_DEBOUNCE_MS)
  }
  return [input, change] as const
}

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
