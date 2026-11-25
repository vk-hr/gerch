import { useHotkey } from "@tanstack/react-hotkeys"
import type { RefObject } from "react"

import { useTabActions } from "@/components/tabs/use-tab-actions.ts"
import { HOTKEYS } from "@/hotkeys.ts"

import { focusedPackage } from "./focused-result.ts"

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

export { useOpenHotkeys }
