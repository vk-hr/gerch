import { ArrowLeft, Trash2 } from "lucide-react"
import { useEffect, useRef } from "react"

import type { Workspace } from "@/client/state.ts"
import { Button } from "@/components/ui/button"

import { PinList } from "./pin-list.tsx"
import { removeWorkspace } from "./workspace-actions.ts"

function WorkspaceDetail({
  onBack,
  workspace,
}: {
  onBack: () => void
  workspace: Workspace
}) {
  const back = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    back.current?.focus()
  }, [])
  return (
    <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={onBack} ref={back} size="sm" variant="outline">
          <ArrowLeft aria-hidden />
          Back to workspaces
        </Button>
        <Button
          className="ml-auto"
          onClick={() => {
            removeWorkspace(workspace.id)
          }}
          size="sm"
          variant="destructive"
        >
          <Trash2 aria-hidden />
          Delete workspace
        </Button>
      </div>
      {workspace.pins.length === 0 ? (
        <p className="text-muted-foreground">
          No pins yet. Press Alt+P on a search result to pin it here.
        </p>
      ) : (
        <PinList fallbackFocus={back} workspace={workspace} />
      )}
    </div>
  )
}

export { WorkspaceDetail }
