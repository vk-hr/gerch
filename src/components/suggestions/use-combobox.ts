import { useHotkey, useHotkeys } from "@tanstack/react-hotkeys"
import { useId, useState } from "react"
import type { RefObject } from "react"

import { HOTKEYS } from "@/hotkeys.ts"

import type { Suggestion } from "./suggest.ts"

interface Combobox {
  shown: boolean
  active: number
  listId: string
  optionId: (index: number) => string
  // Shows the list again after the user types.
  reopen: () => void
  close: () => void
  choose: (suggestion: Suggestion) => void
}

interface ListKeys {
  shown: boolean
  active: number
  count: number
  move: (step: 1 | -1) => void
  pick: () => void
  close: () => void
}

// Keys for the open list, registered on the search box itself, so they run
// before the result-list keys on <main> and stop them (docs/decisions.md
// D23, D27). Past the last suggestion, ↓ is left to <main> and moves on to
// the first result.
function useListKeys(box: RefObject<HTMLInputElement | null>, keys: ListKeys) {
  const onBox = { ignoreInputs: false, target: box } as const
  const down = { ...onBox, enabled: keys.shown && keys.active < keys.count - 1 }
  const up = { ...onBox, enabled: keys.shown && keys.active >= 0 }
  const forward = () => {
    keys.move(1)
  }
  const back = () => {
    keys.move(-1)
  }
  useHotkeys(
    [HOTKEYS.next, HOTKEYS.nextAlt, HOTKEYS.nextAnywhere].map(
      ({ keys: hotkey }) => ({
        callback: forward,
        hotkey,
      })
    ),
    down
  )
  useHotkeys(
    [HOTKEYS.previous, HOTKEYS.previousAlt, HOTKEYS.previousAnywhere].map(
      ({ keys: hotkey }) => ({ callback: back, hotkey })
    ),
    up
  )
  useHotkey(HOTKEYS.open.keys, keys.pick, up)
  useHotkey(HOTKEYS.clear.keys, keys.close, { ...onBox, enabled: keys.shown })
}

// A combobox over the suggestions (WAI-ARIA APG): focus stays in the search
// box and `aria-activedescendant` names the active suggestion.
function useCombobox(
  box: RefObject<HTMLInputElement | null>,
  suggestions: readonly Suggestion[],
  onChoose: (query: string) => void
): Combobox {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const active = suggestions.findIndex((item) => item.query === selected)
  const shown = open && suggestions.length > 0
  const close = () => {
    setOpen(false)
    setSelected(null)
  }
  const choose = (suggestion: Suggestion) => {
    onChoose(suggestion.query)
    close()
  }
  const move = (step: 1 | -1) => {
    setSelected(suggestions[active + step]?.query ?? null)
  }
  useListKeys(box, {
    active,
    close,
    count: suggestions.length,
    move,
    pick: () => {
      const suggestion = suggestions[active]
      if (suggestion !== undefined) {
        choose(suggestion)
      }
    },
    shown,
  })
  return {
    active,
    choose,
    close,
    listId,
    optionId: (index) => `${listId}-${index}`,
    reopen: () => {
      setOpen(true)
      setSelected(null)
    },
    shown,
  }
}

export { useCombobox }
export type { Combobox }
