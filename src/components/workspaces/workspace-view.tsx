import { useState } from "react"

import { useClientState } from "@/client/use-client-state.ts"

import { WorkspaceDetail } from "./workspace-detail.tsx"
import { WorkspaceDialog } from "./workspace-dialog.tsx"
import { WorkspaceList } from "./workspace-list.tsx"

// Flow 7: the workspace list, and one workspace's pins. Deleting the open
// workspace returns to the list.
function WorkspaceView({ onClose }: { onClose: () => void }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const workspace = useClientState((state) =>
    state.workspaces.find((candidate) => candidate.id === openId)
  )
  return (
    <WorkspaceDialog
      description={
        workspace === undefined
          ? "Open a workspace to see its pinned packages."
          : "Pinned packages, with the latest versions gerch has seen."
      }
      onClose={onClose}
      title={workspace?.name ?? "Workspaces"}
    >
      {workspace === undefined ? (
        <WorkspaceList onOpen={setOpenId} />
      ) : (
        <WorkspaceDetail
          onBack={() => {
            setOpenId(null)
          }}
          workspace={workspace}
        />
      )}
    </WorkspaceDialog>
  )
}

export { WorkspaceView }
