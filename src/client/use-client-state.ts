import { useSyncExternalStore } from "react"

import { createClientStore, EMPTY_STATE, STORAGE_KEY } from "./store.ts"
import type { ClientState, ClientStore, StorageLike } from "./store.ts"

let browserStore: ClientStore | null = null

function localStorageOrNull(): StorageLike | null {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

// The page's one store, created on first use in the browser. Changes made in
// another window of gerch arrive through the `storage` event.
function clientStore(): ClientStore {
  if (browserStore === null) {
    const inBrowser = typeof document !== "undefined"
    browserStore = createClientStore(inBrowser ? localStorageOrNull() : null)
    if (inBrowser) {
      globalThis.addEventListener("storage", (event) => {
        if (event instanceof StorageEvent && event.key === STORAGE_KEY) {
          browserStore?.reload()
        }
      })
    }
  }
  return browserStore
}

// Reads saved state. The server and the hydrating render see the empty
// state, so markup matches; the saved state appears on the next render.
// `select` must return a part of the state, not a new object or array.
function useClientState<TSelected>(
  select: (state: ClientState) => TSelected
): TSelected {
  return useSyncExternalStore(
    (listener) => clientStore().subscribe(listener),
    () => select(clientStore().snapshot()),
    () => select(EMPTY_STATE)
  )
}

function updateClientState(change: (state: ClientState) => ClientState) {
  clientStore().update(change)
}

export { updateClientState, useClientState }
