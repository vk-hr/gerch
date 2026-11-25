import { useState } from "react"

import type { Pin } from "@/client/state.ts"
import { useClientState } from "@/client/use-client-state.ts"

import { PickerOptionContent } from "./picker-option.tsx"
import { pinTo } from "./workspace-actions.ts"
import { WorkspaceCombobox } from "./workspace-combobox.tsx"
import { WorkspaceDialog } from "./workspace-dialog.tsx"
import { pickerOptionLabel, pickerOptions } from "./workspaces.ts"
import type { PickerOption } from "./workspaces.ts"

// Flow 6: pin a package to a workspace, or to a new one named in the box.
function PinPicker({ onClose, pin }: { onClose: () => void; pin: Pin }) {
  const workspaces = useClientState((state) => state.workspaces)
  const [input, setInput] = useState("")
  return (
    <WorkspaceDialog
      description="Pick a workspace, or type a name to create one."
      onClose={onClose}
      title={`Pin ${pin.name} to a workspace`}
    >
      <WorkspaceCombobox<PickerOption>
        empty="No workspaces yet. Type a name to create one."
        input={input}
        label="Workspace"
        onChoose={(option) => {
          pinTo(option, pin)
          onClose()
        }}
        onInputChange={setInput}
        optionKey={(option) =>
          option.kind === "create" ? "create" : option.workspace.id
        }
        optionLabel={pickerOptionLabel}
        options={pickerOptions(workspaces, input, pin)}
        placeholder="portfolio deps"
        renderOption={(option) => <PickerOptionContent option={option} />}
      />
    </WorkspaceDialog>
  )
}

export { PinPicker }
