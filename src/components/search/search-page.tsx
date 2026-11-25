import { useHotkey } from "@tanstack/react-hotkeys"
import { useNavigate } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"
import type { RefObject } from "react"

import { HOTKEYS } from "@/hotkeys.ts"
import { parseQuery } from "@/shared/query.ts"

import { useCopied } from "./copied-context.ts"
import { RegistrySection } from "./registry-section.tsx"
import { SearchBox } from "./search-box.tsx"

const URL_DEBOUNCE_MS = 150

function focusedResult(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement
    ? document.activeElement.closest<HTMLElement>("[data-result]")
    : null
}

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
      const install = focusedResult()?.dataset.install
      if (install !== undefined) {
        copy(install)
      }
    },
    inputsToo
  )
}

// Writes the typed query to the URL once typing pauses.
function useQueryInUrl(input: string, query: string) {
  const navigate = useNavigate({ from: "/" })
  useEffect(() => {
    const timer = setTimeout(() => {
      if (input !== query) {
        void navigate({ replace: true, search: { q: input } })
      }
    }, URL_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [input, query, navigate])
}

// Marks the page interactive once the hotkeys are registered. End-to-end
// flows wait on it before pressing keys.
function useInteractiveMarker() {
  useEffect(() => {
    document.body.dataset.interactive = ""
    return () => {
      delete document.body.dataset.interactive
    }
  }, [])
}

function SearchPage({ query }: { query: string }) {
  const searchBox = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLElement>(null)
  const [input, setInput] = useState(query)
  const parsed = parseQuery(query)
  useQueryInUrl(input, query)
  useSearchHotkeys(searchBox, list, () => {
    escape(searchBox.current, input, () => {
      setInput("")
    })
  })
  useInteractiveMarker()

  return (
    <main className="mx-auto grid max-w-3xl gap-6 p-4 sm:p-6" ref={list}>
      <header className="flex items-center gap-3">
        <span className="font-heading text-lg font-medium">gerch</span>
        <SearchBox onChange={setInput} ref={searchBox} value={input} />
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
