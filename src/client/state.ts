// The browser-only state saved across reloads: tabs, workspaces with their
// pins, and search history (docs/decisions.md D15, D24). The server never
// sees it, so anything rendered from it renders on the client.
import { isRegistry } from "@/shared/registry.ts"
import type { PackageSummary, Registry } from "@/shared/registry.ts"

interface SearchTab {
  id: string
  kind: "search"
  // The raw query as typed, prefix included, e.g. "npm:zod".
  query: string
}

interface PackageTab {
  id: string
  kind: "package"
  registry: Registry
  name: string
}

type Tab = PackageTab | SearchTab

interface Pin {
  registry: Registry
  name: string
  // The card as it was when pinned, shown until fresher data arrives.
  summary: PackageSummary
}

interface Workspace {
  id: string
  name: string
  pins: Pin[]
}

interface HistoryEntry {
  // The search text without its prefix; `registry` holds the prefix.
  query: string
  registry: Registry | null
  count: number
  // Epoch milliseconds.
  lastUsed: number
}

interface ClientState {
  version: 1
  tabs: Tab[]
  activeTab: string | null
  // Most recently closed first, for "reopen the last closed tab".
  closedTabs: Tab[]
  workspaces: Workspace[]
  history: HistoryEntry[]
}

const EMPTY_STATE: ClientState = {
  activeTab: null,
  closedTabs: [],
  history: [],
  tabs: [],
  version: 1,
  workspaces: [],
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === "string"
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isRegistryValue(value: unknown): value is Registry {
  return isString(value) && isRegistry(value)
}

function isTab(value: unknown): value is Tab {
  if (!isObject(value) || !isString(value.id)) {
    return false
  }
  if (value.kind === "search") {
    return isString(value.query)
  }
  return (
    value.kind === "package" &&
    isRegistryValue(value.registry) &&
    isString(value.name)
  )
}

function isSummary(value: unknown): value is PackageSummary {
  return (
    isObject(value) &&
    isRegistryValue(value.registry) &&
    isString(value.name) &&
    isString(value.version) &&
    isString(value.install) &&
    isNullableString(value.releasedAt) &&
    isNullableString(value.license) &&
    isNullableString(value.description) &&
    isNullableString(value.repository) &&
    isNullableString(value.homepage) &&
    (value.downloads === null || isObject(value.downloads))
  )
}

function isPin(value: unknown): value is Pin {
  return (
    isObject(value) &&
    isRegistryValue(value.registry) &&
    isString(value.name) &&
    isSummary(value.summary)
  )
}

function isWorkspace(value: unknown): value is Workspace {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.name) &&
    Array.isArray(value.pins)
  )
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  return (
    isObject(value) &&
    isString(value.query) &&
    (value.registry === null || isRegistryValue(value.registry)) &&
    typeof value.count === "number" &&
    typeof value.lastUsed === "number"
  )
}

function listOf<TItem>(
  value: unknown,
  isItem: (item: unknown) => item is TItem
): TItem[] {
  return Array.isArray(value)
    ? value.filter((item): item is TItem => isItem(item))
    : []
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Reads saved state, keeping every valid entry and dropping the rest, so one
// bad entry never costs the user their tabs.
function parseState(raw: string | null): ClientState {
  const value = raw === null ? null : parseJson(raw)
  if (!isObject(value) || value.version !== EMPTY_STATE.version) {
    return EMPTY_STATE
  }
  const tabs = listOf(value.tabs, isTab)
  const activeTab = tabs.find((tab) => tab.id === value.activeTab)?.id ?? null
  return {
    activeTab,
    closedTabs: listOf(value.closedTabs, isTab),
    history: listOf(value.history, isHistoryEntry),
    tabs,
    version: EMPTY_STATE.version,
    workspaces: listOf(value.workspaces, isWorkspace).map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      pins: listOf(workspace.pins, isPin),
    })),
  }
}

export { EMPTY_STATE, parseState }
export type {
  ClientState,
  HistoryEntry,
  PackageTab,
  Pin,
  SearchTab,
  Tab,
  Workspace,
}
