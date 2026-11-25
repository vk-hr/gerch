import { useHotkey } from "@tanstack/react-hotkeys"
import { useQueryClient } from "@tanstack/react-query"

import type { Pin } from "@/client/state.ts"
import {
  focusedPackage,
  focusInDialog,
} from "@/components/search/focused-result.ts"
import { HOTKEYS } from "@/hotkeys.ts"

import { cachedResults } from "./cached-results.ts"
import { newestCached } from "./workspaces.ts"

type OpenDialog =
  { kind: "closed" } | { kind: "pin"; pin: Pin } | { kind: "workspaces" }

// Alt+P pins the focused result; Alt+W opens the workspace view. Both work
// from the search box too, so they listen with inputs included. Alt+P
// ignores cards inside a dialog: those are already pinned.
function useWorkspaceHotkeys(open: (dialog: OpenDialog) => void) {
  const queryClient = useQueryClient()
  const inputsToo = { ignoreInputs: false } as const
  useHotkey(
    HOTKEYS.pin.keys,
    () => {
      const focused = focusInDialog() ? null : focusedPackage()
      const summary =
        focused === null
          ? null
          : newestCached(focused, cachedResults(queryClient))
      if (summary !== null) {
        open({
          kind: "pin",
          pin: { name: summary.name, registry: summary.registry, summary },
        })
      }
    },
    inputsToo
  )
  useHotkey(
    HOTKEYS.workspaces.keys,
    () => {
      open({ kind: "workspaces" })
    },
    inputsToo
  )
}

export { useWorkspaceHotkeys }
export type { OpenDialog }
