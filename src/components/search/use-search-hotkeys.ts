import { useHotkey } from "@tanstack/react-hotkeys"
import type { RefObject } from "react"

import { HOTKEYS } from "@/hotkeys.ts"

import { useCopied } from "./copied-context.ts"
import {
  focusedPackage,
  focusedResult,
  focusInDialog,
} from "./focused-result.ts"

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
  const focusSearch = () => {
    if (!focusInDialog()) {
      searchBox.current?.focus()
    }
  }
  useHotkey(HOTKEYS.focusSearch.keys, focusSearch)
  useHotkey(HOTKEYS.focusSearchMod.keys, focusSearch)
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

export { escape, useSearchHotkeys }
