// Pure changes to the saved tabs (docs/decisions.md D25). Each takes the
// client state and returns the next one; callers navigate afterwards.
import type { ClientState, Tab } from "@/client/state.ts"
import type { Registry } from "@/shared/registry.ts"

type TabContent =
  | { kind: "search"; query: string }
  | { kind: "package"; registry: Registry; name: string }

const CLOSED_TABS_CAP = 20

function sameContent(tab: Tab, content: TabContent): boolean {
  if (tab.kind === "search") {
    return content.kind === "search" && tab.query === content.query
  }
  return (
    content.kind === "package" &&
    tab.registry === content.registry &&
    tab.name === content.name
  )
}

function activeIndex(state: ClientState): number {
  return state.tabs.findIndex((tab) => tab.id === state.activeTab)
}

function activeTabOf(state: ClientState): Tab | null {
  return state.tabs[activeIndex(state)] ?? null
}

function withTabs(state: ClientState, tabs: Tab[], activeTab: string | null) {
  return { ...state, activeTab, tabs }
}

// Inserts a tab at `index` (the end when -1) and makes it active.
function insertActive(state: ClientState, tab: Tab, index: number) {
  const tabs = [...state.tabs]
  tabs.splice(index === -1 ? tabs.length : index, 0, tab)
  return withTabs(state, tabs, tab.id)
}

// Shows `content` in the active tab, or in a new tab when none is active.
function showInActiveTab(
  state: ClientState,
  content: TabContent,
  newId: string
): ClientState {
  const index = activeIndex(state)
  const active = state.tabs[index]
  if (active === undefined) {
    return insertActive(state, { ...content, id: newId }, -1)
  }
  if (sameContent(active, content)) {
    return state
  }
  const shown: Tab = { ...content, id: active.id }
  return withTabs(
    state,
    state.tabs.map((tab) => (tab === active ? shown : tab)),
    active.id
  )
}

// Activates a tab that already shows the route; null when none does.
function activateShowing(
  state: ClientState,
  content: TabContent
): ClientState | null {
  const active = activeTabOf(state)
  if (active !== null && sameContent(active, content)) {
    return state
  }
  const showing = state.tabs.find((tab) => sameContent(tab, content))
  return showing === undefined ? null : withTabs(state, state.tabs, showing.id)
}

// The page loaded on a route, maybe from a shared link: a tab that shows it
// becomes active, or a new tab opens, so a link never replaces a saved tab.
function followFirstRoute(
  state: ClientState,
  content: TabContent,
  newId: string
): ClientState {
  return (
    activateShowing(state, content) ??
    insertActive(state, { ...content, id: newId }, -1)
  )
}

// The route changed by back, forward or a link: a tab that shows it becomes
// active, or the active tab shows it.
function followRoute(
  state: ClientState,
  content: TabContent,
  newId: string
): ClientState {
  return (
    activateShowing(state, content) ?? showInActiveTab(state, content, newId)
  )
}

// Keep consecutive background package tabs in opening order.
function openNextToActive(
  state: ClientState,
  content: TabContent,
  newId: string
): ClientState {
  const tabs = [...state.tabs]
  const after = activeIndex(state) + 1
  const run = tabs.slice(after).findIndex((tab) => tab.kind !== "package")
  tabs.splice(run === -1 ? tabs.length : after + run, 0, {
    ...content,
    id: newId,
  })
  return withTabs(state, tabs, state.activeTab ?? newId)
}

function activateTab(state: ClientState, id: string): ClientState {
  return state.tabs.some((tab) => tab.id === id)
    ? withTabs(state, state.tabs, id)
    : state
}

// The next or previous tab, wrapping around the ends.
function stepTab(state: ClientState, step: 1 | -1): ClientState {
  const { length } = state.tabs
  const next = state.tabs[(activeIndex(state) + step + length) % length]
  return next === undefined ? state : activateTab(state, next.id)
}

// Swaps the active tab with its neighbour; does nothing at either end.
function moveTab(state: ClientState, step: 1 | -1): ClientState {
  const index = activeIndex(state)
  const active = state.tabs[index]
  const neighbour = state.tabs[index + step]
  if (active === undefined || neighbour === undefined) {
    return state
  }
  const tabs = [...state.tabs]
  tabs[index] = neighbour
  tabs[index + step] = active
  return withTabs(state, tabs, active.id)
}

function remember(state: ClientState, closed: Tab): Tab[] {
  return [closed, ...state.closedTabs].slice(0, CLOSED_TABS_CAP)
}

// The tab to activate once `index` closes: its right neighbour, or its left
// one at the end.
function nextActive(state: ClientState, tabs: Tab[], index: number) {
  const closed = state.tabs[index]
  if (closed?.id !== state.activeTab) {
    return state.activeTab
  }
  return tabs[Math.min(index, tabs.length - 1)]?.id ?? null
}

// Closes a tab and remembers it for reopening. Closing the last tab leaves
// an empty search tab.
function closeTab(state: ClientState, id: string, newId: string): ClientState {
  const index = state.tabs.findIndex((tab) => tab.id === id)
  const closed = state.tabs[index]
  if (closed === undefined) {
    return state
  }
  const tabs = state.tabs.filter((tab) => tab !== closed)
  const closedTabs = remember(state, closed)
  if (tabs.length === 0) {
    const empty: Tab = { id: newId, kind: "search", query: "" }
    return { ...state, activeTab: newId, closedTabs, tabs: [empty] }
  }
  return {
    ...state,
    activeTab: nextActive(state, tabs, index),
    closedTabs,
    tabs,
  }
}

// Reopens the most recently closed tab after the active one.
function reopenTab(state: ClientState): ClientState {
  const [last, ...rest] = state.closedTabs
  if (last === undefined) {
    return state
  }
  const reopened = insertActive(state, last, activeIndex(state) + 1)
  return { ...reopened, closedTabs: rest }
}

export {
  activateTab,
  activeTabOf,
  CLOSED_TABS_CAP,
  closeTab,
  followFirstRoute,
  followRoute,
  moveTab,
  openNextToActive,
  reopenTab,
  sameContent,
  showInActiveTab,
  stepTab,
}
export type { TabContent }
