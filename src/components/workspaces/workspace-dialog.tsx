import { Dialog } from "@base-ui/react/dialog"
import type { ReactNode } from "react"

// A modal dialog in the base-luma style. Escape and a click outside close
// it. WorkspaceDialogs returns focus after it unmounts.
function WorkspaceDialog({
  children,
  description,
  onClose,
  title,
}: {
  children: ReactNode
  description: string
  onClose: () => void
  title: string
}) {
  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      open
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 isolate z-50 bg-black/30 supports-backdrop-filter:backdrop-blur-sm" />
        <Dialog.Popup
          finalFocus={false}
          className="fixed top-[12vh] left-1/2 z-50 grid max-h-[76vh] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 grid-rows-[auto_auto_minmax(0,1fr)] gap-4 rounded-4xl bg-popover p-6 text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/5 outline-none sm:max-w-xl dark:ring-foreground/10"
        >
          <Dialog.Title className="font-heading text-base leading-none font-medium">
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-muted-foreground">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export { WorkspaceDialog }
