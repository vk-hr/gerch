import { useHotkey } from "@tanstack/react-hotkeys"

import { HOTKEYS } from "@/hotkeys.ts"

import type { TabActions } from "./use-tab-actions.ts"

// Tab shortcuts work anywhere, the search box included.
const ANYWHERE = { ignoreInputs: false } as const

function useTabHotkeys(actions: TabActions) {
  useHotkey(
    HOTKEYS.nextTab.keys,
    () => {
      actions.step(1)
    },
    ANYWHERE
  )
  useHotkey(
    HOTKEYS.previousTab.keys,
    () => {
      actions.step(-1)
    },
    ANYWHERE
  )
  useHotkey(
    HOTKEYS.moveTabRight.keys,
    () => {
      actions.move(1)
    },
    ANYWHERE
  )
  useHotkey(
    HOTKEYS.moveTabLeft.keys,
    () => {
      actions.move(-1)
    },
    ANYWHERE
  )
  useHotkey(HOTKEYS.closeTab.keys, actions.closeActive, ANYWHERE)
  useHotkey(HOTKEYS.reopenTab.keys, actions.reopen, ANYWHERE)
}

export { useTabHotkeys }
