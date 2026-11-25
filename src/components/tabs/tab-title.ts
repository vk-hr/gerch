import type { Tab } from "@/client/state.ts"
import { REGISTRY_LABELS } from "@/shared/registry.ts"

// A tab's full name, as screen readers hear it.
function tabTitle(tab: Tab): string {
  if (tab.kind === "search") {
    return tab.query === "" ? "New search" : `Search ${tab.query}`
  }
  return `${REGISTRY_LABELS[tab.registry]} package ${tab.name}`
}

export { tabTitle }
