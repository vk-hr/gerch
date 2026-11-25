import { X } from "lucide-react"

import type { Tab } from "@/client/state.ts"
import { cn } from "@/lib/utils.ts"

import { TabLink } from "./tab-link.tsx"
import { tabTitle } from "./tab-title.ts"
import type { TabActions } from "./use-tab-actions.ts"

function TabItem({
  actions,
  active,
  tab,
}: {
  actions: TabActions
  active: boolean
  tab: Tab
}) {
  return (
    <li
      className={cn(
        "flex h-8 max-w-48 shrink-0 items-center rounded-t-lg border border-b-0 text-xs",
        active
          ? "border-border bg-card text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <TabLink
        active={active}
        onActivate={() => {
          actions.markActive(tab.id)
        }}
        tab={tab}
      />
      <button
        aria-label={`Close ${tabTitle(tab)}`}
        className="mr-1 rounded p-0.5 hover:bg-muted"
        onClick={() => {
          actions.close(tab.id)
        }}
        type="button"
      >
        <X aria-hidden className="size-3" />
      </button>
    </li>
  )
}

export { TabItem }
