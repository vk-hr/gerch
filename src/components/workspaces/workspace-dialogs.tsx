import { lazy, Suspense, useEffect, useState } from "react"

import { useWorkspaceHotkeys } from "./use-workspace-hotkeys.ts"
import type { OpenDialog } from "./use-workspace-hotkeys.ts"

// Both dialogs load on first use, so they stay out of the first view's
// JavaScript (docs/directives/performance.md, "Load on intent").
const PinPicker = lazy(async () => {
  const module = await import("./pin-picker.tsx")
  return { default: module.PinPicker }
})
const WorkspaceView = lazy(async () => {
  const module = await import("./workspace-view.tsx")
  return { default: module.WorkspaceView }
})

const CLOSED: OpenDialog = { kind: "closed" }

interface Dialogs {
  dialog: OpenDialog
  // Where focus was when the first dialog opened, such as the pinned card.
  returnFocus: HTMLElement | null
}

function activeElement(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null
}

// Mounted once at the root, so Alt+P and Alt+W work on every page. Closing
// returns focus once the dialog has left the page.
function WorkspaceDialogs() {
  const [dialogs, setDialogs] = useState<Dialogs>({
    dialog: CLOSED,
    returnFocus: null,
  })
  const { dialog, returnFocus } = dialogs
  useWorkspaceHotkeys((next) => {
    const focused = activeElement()
    setDialogs((current) => ({
      dialog: next,
      returnFocus:
        current.dialog.kind === "closed" ? focused : current.returnFocus,
    }))
  })
  useEffect(() => {
    if (dialog.kind === "closed") {
      returnFocus?.focus()
    }
  }, [dialog, returnFocus])
  const close = () => {
    setDialogs((current) => ({ ...current, dialog: CLOSED }))
  }
  return (
    <Suspense fallback={null}>
      {dialog.kind === "pin" ? (
        <PinPicker onClose={close} pin={dialog.pin} />
      ) : null}
      {dialog.kind === "workspaces" ? <WorkspaceView onClose={close} /> : null}
    </Suspense>
  )
}

export { WorkspaceDialogs }
