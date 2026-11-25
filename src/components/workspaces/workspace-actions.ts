// The saved-state writes behind the picker and the workspace view.
import type { Pin } from "@/client/state.ts"
import { updateClientState } from "@/client/use-client-state.ts"

import {
  addPin,
  createWorkspace,
  deleteWorkspace,
  removePin,
} from "./workspaces.ts"
import type { PackageRef, PickerOption } from "./workspaces.ts"

function pinTo(option: PickerOption, pin: Pin) {
  updateClientState((state) => {
    const target =
      option.kind === "workspace"
        ? { id: option.workspace.id, workspaces: state.workspaces }
        : createWorkspace(state.workspaces, option.name, crypto.randomUUID())
    return { ...state, workspaces: addPin(target.workspaces, target.id, pin) }
  })
}

function unpin(workspaceId: string, ref: PackageRef) {
  updateClientState((state) => ({
    ...state,
    workspaces: removePin(state.workspaces, workspaceId, ref),
  }))
}

function removeWorkspace(workspaceId: string) {
  updateClientState((state) => ({
    ...state,
    workspaces: deleteWorkspace(state.workspaces, workspaceId),
  }))
}

export { pinTo, removeWorkspace, unpin }
