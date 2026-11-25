import { describe, expect, test, vi } from "vitest"

import { createClientStore, EMPTY_STATE, STORAGE_KEY } from "@/client/store.ts"
import type { ClientState, StorageLike } from "@/client/store.ts"

function memoryStorage(initial?: string): StorageLike & { value?: string } {
  const storage: StorageLike & { value?: string } = {
    getItem: () => storage.value ?? null,
    setItem: (_key, value) => {
      storage.value = value
    },
  }
  if (initial !== undefined) {
    storage.value = initial
  }
  return storage
}

const searchTab = { id: "t1", kind: "search", query: "zod" } as const
const packageTab = {
  id: "t2",
  kind: "package",
  name: "zod",
  registry: "npm",
} as const

function stateWith(partial: Partial<ClientState>): ClientState {
  return { ...EMPTY_STATE, ...partial }
}

describe("client store", () => {
  test("starts empty without storage or a saved value", () => {
    expect.hasAssertions()
    expect(createClientStore(null).snapshot()).toStrictEqual(EMPTY_STATE)
    expect(createClientStore(memoryStorage()).snapshot()).toStrictEqual(
      EMPTY_STATE
    )
  })

  test("saves updates under one versioned key and restores them", () => {
    expect.hasAssertions()
    const storage = memoryStorage()
    const store = createClientStore(storage)
    store.update((state) => ({
      ...state,
      activeTab: "t2",
      tabs: [searchTab, packageTab],
    }))
    expect(STORAGE_KEY).toBe("gerch:v1")
    const restored = createClientStore(storage).snapshot()
    expect(restored.tabs).toStrictEqual([searchTab, packageTab])
    expect(restored.activeTab).toBe("t2")
  })

  test("returns the same snapshot until something changes", () => {
    expect.hasAssertions()
    const store = createClientStore(memoryStorage())
    const first = store.snapshot()
    expect(store.snapshot()).toBe(first)
    store.update((state) => ({ ...state, activeTab: null }))
    expect(store.snapshot()).not.toBe(first)
  })

  test("ignores malformed JSON and other versions", () => {
    expect.hasAssertions()
    expect(createClientStore(memoryStorage("{")).snapshot()).toStrictEqual(
      EMPTY_STATE
    )
    const other = JSON.stringify({ ...EMPTY_STATE, version: 2 })
    expect(createClientStore(memoryStorage(other)).snapshot()).toStrictEqual(
      EMPTY_STATE
    )
  })

  test("drops entries that don't match their type", () => {
    expect.hasAssertions()
    const saved = JSON.stringify({
      ...EMPTY_STATE,
      history: [
        { count: 2, lastUsed: 1, query: "zod", registry: null },
        { count: "2", lastUsed: 1, query: "zod", registry: null },
      ],
      tabs: [searchTab, { id: "t3", kind: "package", registry: "pypi" }],
      workspaces: [
        { id: "w1", name: "deps", pins: [] },
        { id: "w2", pins: [] },
      ],
    })
    const state = createClientStore(memoryStorage(saved)).snapshot()
    expect(state.tabs).toStrictEqual([searchTab])
    expect(state.history).toHaveLength(1)
    expect(state.workspaces.map((workspace) => workspace.id)).toStrictEqual([
      "w1",
    ])
  })

  test("drops an active tab that no longer exists", () => {
    expect.hasAssertions()
    const saved = JSON.stringify(stateWith({ activeTab: "gone", tabs: [] }))
    expect(
      createClientStore(memoryStorage(saved)).snapshot().activeTab
    ).toBeNull()
  })

  test("keeps working in memory when storage refuses a write", () => {
    expect.hasAssertions()
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError")
      },
    }
    const warn = vi.spyOn(console, "warn").mockReturnValue()
    const store = createClientStore(storage)
    store.update((state) => ({ ...state, tabs: [searchTab] }))
    expect(store.snapshot().tabs).toStrictEqual([searchTab])
    expect(warn).toHaveBeenCalledOnce()
  })

  test("notifies subscribers on updates and on changes from other windows", () => {
    expect.hasAssertions()
    const storage = memoryStorage()
    const store = createClientStore(storage)
    const calls: number[] = []
    const unsubscribe = store.subscribe(() => {
      calls.push(calls.length)
    })
    store.update((state) => ({ ...state, tabs: [searchTab] }))
    storage.value = JSON.stringify(stateWith({ tabs: [packageTab] }))
    store.reload()
    expect(store.snapshot().tabs).toStrictEqual([packageTab])
    unsubscribe()
    store.update((state) => ({ ...state, tabs: [] }))
    expect(calls).toHaveLength(2)
  })
})
