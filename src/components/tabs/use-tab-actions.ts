import { useNavigate } from "@tanstack/react-router"

import type { ClientState } from "@/client/state.ts"
import { updateClientState } from "@/client/use-client-state.ts"

import {
  activateTab,
  activeTabOf,
  closeTab,
  moveTab,
  openNextToActive,
  reopenTab,
  showInActiveTab,
  stepTab,
} from "./tab-list.ts"
import type { TabContent } from "./tab-list.ts"
import { goToTab } from "./tab-route.ts"

type Change = (state: ClientState, newId: string) => ClientState

// Every tab action changes the saved tabs first, then shows the active tab's
// route when the action changed it. Saving first means the route that
// follows already matches the active tab (see useFollowRoute).
function useTabActions() {
  const navigate = useNavigate()
  const apply = (change: Change, replace = false) => {
    const seen: { before?: ClientState; after?: ClientState } = {}
    updateClientState((state) => {
      seen.before = state
      seen.after = change(state, crypto.randomUUID())
      return seen.after
    })
    const shown = seen.after === undefined ? null : activeTabOf(seen.after)
    const wasShown = seen.before === undefined ? null : activeTabOf(seen.before)
    // Tabs keep their object when unchanged, so a new one means a new route.
    if (shown !== null && shown !== wasShown) {
      void goToTab(navigate, shown, replace)
    }
  }
  return {
    // For a tab link's own click: the link navigates, so only save.
    markActive: (id: string) => {
      updateClientState((state) => activateTab(state, id))
    },
    close: (id: string) => {
      apply((state, newId) => closeTab(state, id, newId), true)
    },
    closeActive: () => {
      apply(
        (state, newId) => closeTab(state, state.activeTab ?? "", newId),
        true
      )
    },
    move: (step: 1 | -1) => {
      apply((state) => moveTab(state, step))
    },
    openNext: (content: TabContent) => {
      apply((state, newId) => openNextToActive(state, content, newId))
    },
    reopen: () => {
      apply(reopenTab)
    },
    show: (content: TabContent, replace = false) => {
      apply((state, newId) => showInActiveTab(state, content, newId), replace)
    },
    step: (step: 1 | -1) => {
      apply((state) => stepTab(state, step))
    },
  }
}

type TabActions = ReturnType<typeof useTabActions>

export { useTabActions }
export type { TabActions }
