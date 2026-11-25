import { useEffect, useId, useRef } from "react"

import { ShortcutTable } from "./shortcut-table.tsx"

// A modal <dialog>: the browser traps focus, closes it on Escape and gives
// focus back to where it was.
function ShortcutDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  return (
    <dialog
      aria-labelledby={titleId}
      className="m-auto w-full max-w-lg rounded-xl border border-border bg-popover p-5 text-sm text-popover-foreground shadow-lg backdrop:bg-foreground/20"
      onClose={onClose}
      ref={dialog}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-heading text-base font-medium" id={titleId}>
          Keyboard shortcuts
        </h2>
        <form method="dialog">
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            type="submit"
          >
            Close
          </button>
        </form>
      </div>
      <ShortcutTable />
    </dialog>
  )
}

export { ShortcutDialog }
