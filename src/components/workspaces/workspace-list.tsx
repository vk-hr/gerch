import { useState } from "react"

import type { Workspace } from "@/client/state.ts"
import { useClientState } from "@/client/use-client-state.ts"

import { WorkspaceCombobox } from "./workspace-combobox.tsx"
import { matchingWorkspaces } from "./workspaces.ts"

function pinCount(workspace: Workspace): string {
  return workspace.pins.length === 1 ? "1 pin" : `${workspace.pins.length} pins`
}

function WorkspaceList({ onOpen }: { onOpen: (id: string) => void }) {
  const workspaces = useClientState((state) => state.workspaces)
  const [input, setInput] = useState("")
  return (
    <WorkspaceCombobox<Workspace>
      empty={
        workspaces.length === 0
          ? "No workspaces yet. Press Alt+P on a search result to pin it."
          : "No workspace has that name."
      }
      input={input}
      label="Workspace"
      onChoose={(workspace) => {
        onOpen(workspace.id)
      }}
      onInputChange={setInput}
      optionKey={(workspace) => workspace.id}
      optionLabel={(workspace) => workspace.name}
      options={matchingWorkspaces(workspaces, input)}
      placeholder="Filter workspaces"
      renderOption={(workspace) => (
        <>
          <span className="truncate">{workspace.name}</span>
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {pinCount(workspace)}
          </span>
        </>
      )}
    />
  )
}

export { WorkspaceList }
