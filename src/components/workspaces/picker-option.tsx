import { Check, Plus } from "lucide-react"

import type { PickerOption } from "./workspaces.ts"

function PickerOptionContent({ option }: { option: PickerOption }) {
  if (option.kind === "create") {
    return (
      <>
        <Plus aria-hidden className="size-4 shrink-0" />
        <span>Create &quot;{option.name}&quot;</span>
      </>
    )
  }
  return (
    <>
      <span className="truncate">{option.workspace.name}</span>
      {option.pinned ? (
        <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground">
          <Check aria-hidden className="size-3" />
          pinned
        </span>
      ) : null}
    </>
  )
}

export { PickerOptionContent }
