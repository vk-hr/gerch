import { ArrowLeft, Trash2 } from "lucide-react"
import { useLayoutEffect, useRef } from "react"

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
  // Before the first paint, like the list's box (D34).
  useLayoutEffect(() => {
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
          onClick={(event) => {
            // This button goes away with the workspace. Focus moves to the
            // dialog first, so the dialog doesn't refocus itself after the
            // list's box takes focus (that order differs under Redact, D32).
            event.currentTarget.closest<HTMLElement>("[role='dialog']")?.focus()
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
