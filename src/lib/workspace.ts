import type { Registry } from "@/server/registries/record"

import { Store } from "@tanstack/react-store"

export type WorkspaceTab = { registry: Registry; name: string }

type WorkspaceState = {
  tabs: WorkspaceTab[]
}

const STORAGE_KEY = "gerch:workspace"

function load(): WorkspaceState {
  if (typeof window === "undefined") return { tabs: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { tabs: [] }
    const parsed = JSON.parse(raw)
    return {
      tabs: Array.isArray(parsed.tabs) ? parsed.tabs : [],
    }
  } catch {
    return { tabs: [] }
  }
}

export const workspaceStore = new Store<WorkspaceState>(load())

if (typeof window !== "undefined") {
  workspaceStore.subscribe(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaceStore.state))
  })
}

export function openTab(tab: WorkspaceTab): void {
  workspaceStore.setState((state) => {
    const exists = state.tabs.some(
      (existing) =>
        existing.registry === tab.registry && existing.name === tab.name
    )
    return exists ? state : { ...state, tabs: [...state.tabs, tab] }
  })
}

export function closeTab(tab: WorkspaceTab): void {
  workspaceStore.setState((state) => ({
    ...state,
    tabs: state.tabs.filter(
      (existing) =>
        !(existing.registry === tab.registry && existing.name === tab.name)
    ),
  }))
}
