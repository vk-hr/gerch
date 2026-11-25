import { useHotkey } from "@tanstack/react-hotkeys"
import { lazy, Suspense, useState } from "react"

import { focusInDialog } from "@/components/search/focused-result.ts"
import { HOTKEYS } from "@/hotkeys.ts"

// A rarely used tool, so its dialog loads when first opened.
const ShortcutDialog = lazy(async () => {
  const { ShortcutDialog: Dialog } = await import("./shortcut-dialog.tsx")
  return { default: Dialog }
})

// `?` opens the shortcut list. Like every single-key shortcut, it doesn't
// fire while typing in a text field.
function ShortcutList() {
  const [open, setOpen] = useState(false)
  useHotkey(HOTKEYS.shortcuts.keys, () => {
    if (!focusInDialog()) {
      setOpen(true)
    }
  })
  return open ? (
    <Suspense fallback={null}>
      <ShortcutDialog
        onClose={() => {
          setOpen(false)
        }}
      />
    </Suspense>
  ) : null
}

export { ShortcutList }
