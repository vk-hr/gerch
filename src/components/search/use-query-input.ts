import { useEffect, useRef, useState } from "react"
import type { RefObject } from "react"

import { useClientState } from "@/client/use-client-state.ts"
import { useTabActions } from "@/components/tabs/use-tab-actions.ts"

const URL_DEBOUNCE_MS = 150

type Timer = ReturnType<typeof setTimeout>

function cancel(pending: RefObject<Timer | null>) {
  if (pending.current !== null) {
    clearTimeout(pending.current)
  }
}

// The search box's text, kept in step with the URL's `q`. Typing writes `q`
// once typing pauses, in the current tab. A `q` that changes from outside
// (back, forward) or a change of active tab (switching, closing) replaces the
// text and drops any write still waiting, so it never lands in another tab or
// overwrites the history entry the user went to.
function useQueryInput(query: string) {
  const tabs = useTabActions()
  const activeTab = useClientState((state) => state.activeTab)
  const [input, setInput] = useState(query)
  const written = useRef(query)
  const shownTab = useRef(activeTab)
  const pending = useRef<Timer>(null)
  useEffect(() => {
    if (query !== written.current || activeTab !== shownTab.current) {
      written.current = query
      shownTab.current = activeTab
      cancel(pending)
      setInput(query)
    }
  }, [query, activeTab])
  useEffect(
    () => () => {
      cancel(pending)
    },
    []
  )
  const change = (value: string) => {
    setInput(value)
    cancel(pending)
    pending.current = setTimeout(() => {
      written.current = value
      tabs.show({ kind: "search", query: value }, true)
    }, URL_DEBOUNCE_MS)
  }
  return [input, change] as const
}

export { useQueryInput }
