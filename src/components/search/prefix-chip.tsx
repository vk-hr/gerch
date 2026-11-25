import { X } from "lucide-react"

import type { Registry } from "@/shared/registry.ts"

// A recognized prefix, shown inside the search box. Backspace on an empty
// query removes it too.
function PrefixChip({
  onRemove,
  prefix,
}: {
  onRemove: () => void
  prefix: Registry
}) {
  return (
    <button
      aria-label={`Remove the ${prefix} prefix`}
      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-heading text-xs hover:bg-accent"
      onClick={onRemove}
      tabIndex={-1}
      type="button"
    >
      {prefix}
      <X aria-hidden className="size-3" />
    </button>
  )
}

export { PrefixChip }
