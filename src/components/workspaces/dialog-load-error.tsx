// Shown when a dialog's code can't load (offline, or a deploy replaced the
// chunk). The page behind stays usable.
function DialogLoadError() {
  return (
    <p
      className="fixed inset-x-4 bottom-4 mx-auto max-w-md rounded-xl border border-destructive/30 bg-background p-3 text-sm shadow-lg"
      role="alert"
    >
      Workspaces didn&apos;t load. Reload the page to try again.
    </p>
  )
}

export { DialogLoadError }
