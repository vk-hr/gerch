import { Link } from "@tanstack/react-router"
import type { MouseEvent } from "react"

import type { Tab } from "@/client/state.ts"

import { TabLabel } from "./tab-label.tsx"

// A modified click opens the link in a browser tab and leaves this page.
function isPlainClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  )
}

const LINK_CLASS =
  "flex min-w-0 items-center gap-1.5 py-1 pr-1 pl-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/40"

function TabLink({
  active,
  onActivate,
  tab,
}: {
  active: boolean
  onActivate: () => void
  tab: Tab
}) {
  const current = active ? "page" : undefined
  const onClick = (event: MouseEvent) => {
    if (isPlainClick(event)) {
      onActivate()
    }
  }
  return tab.kind === "search" ? (
    <Link
      aria-current={current}
      className={LINK_CLASS}
      onClick={onClick}
      search={tab.query === "" ? {} : { q: tab.query }}
      to="/"
    >
      <TabLabel tab={tab} />
    </Link>
  ) : (
    <Link
      aria-current={current}
      className={LINK_CLASS}
      onClick={onClick}
      params={{ name: tab.name, registry: tab.registry }}
      to="/p/$registry/$name"
    >
      <TabLabel tab={tab} />
    </Link>
  )
}

export { TabLink }
