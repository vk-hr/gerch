import { Package, Search } from "lucide-react"

import type { Tab } from "@/client/state.ts"
import { REGISTRY_LABELS } from "@/shared/registry.ts"

// What a tab shows. The hidden words make its name match tabTitle.
function TabLabel({ tab }: { tab: Tab }) {
  if (tab.kind === "search") {
    return (
      <>
        <Search aria-hidden className="size-3.5 shrink-0" />
        {tab.query === "" ? (
          "New search"
        ) : (
          <>
            <span className="sr-only">Search </span>
            <span className="truncate">{tab.query}</span>
          </>
        )}
      </>
    )
  }
  return (
    <>
      <Package aria-hidden className="size-3.5 shrink-0" />
      <span className="sr-only">{REGISTRY_LABELS[tab.registry]} package </span>
      <span className="truncate">{tab.name}</span>
    </>
  )
}

export { TabLabel }
