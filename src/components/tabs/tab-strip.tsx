import { useClientState } from "@/client/use-client-state.ts"

import { TabItem } from "./tab-item.tsx"
import { useFollowRoute } from "./use-follow-route.ts"
import { useTabActions } from "./use-tab-actions.ts"
import { useTabHotkeys } from "./use-tab-hotkeys.ts"

// The open tabs. They live in localStorage, so the server renders this slot
// empty at its full height and the tabs appear without moving the page.
function TabStrip() {
  const tabs = useClientState((state) => state.tabs)
  const activeTab = useClientState((state) => state.activeTab)
  const actions = useTabActions()
  useFollowRoute()
  useTabHotkeys(actions)
  return (
    <nav aria-label="Tabs" className="h-10 border-b border-border">
      <ul className="mx-auto flex h-full max-w-3xl items-end gap-1 overflow-x-auto px-4 sm:px-6">
        {tabs.map((tab) => (
          <TabItem
            actions={actions}
            active={tab.id === activeTab}
            key={tab.id}
            tab={tab}
          />
        ))}
      </ul>
    </nav>
  )
}

export { TabStrip }
