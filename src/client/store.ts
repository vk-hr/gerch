import { EMPTY_STATE, parseState } from "./state.ts"
import type { ClientState } from "./state.ts"

const STORAGE_KEY = "gerch:v1"

type StorageLike = Pick<Storage, "getItem" | "setItem">

interface ClientStore {
  snapshot: () => ClientState
  update: (change: (state: ClientState) => ClientState) => void
  subscribe: (listener: () => void) => () => void
  // Rereads storage after another window changed it.
  reload: () => void
}

function readStorage(storage: StorageLike | null): ClientState {
  try {
    return parseState(storage?.getItem(STORAGE_KEY) ?? null)
  } catch {
    return EMPTY_STATE
  }
}

// One in-memory copy of the saved state. A write that storage refuses (quota,
// private mode) still updates the page; it just won't survive a reload.
function createClientStore(storage: StorageLike | null): ClientStore {
  let state: ClientState | null = null
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) {
      listener()
    }
  }
  const snapshot = () => {
    state ??= readStorage(storage)
    return state
  }
  return {
    reload: () => {
      state = readStorage(storage)
      notify()
    },
    snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    update: (change) => {
      state = change(snapshot())
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch (error) {
        console.warn("Saving gerch state failed", error)
      }
      notify()
    },
  }
}

export { createClientStore, STORAGE_KEY }
export { EMPTY_STATE } from "./state.ts"
export type { ClientStore, StorageLike }
export type { ClientState } from "./state.ts"
