import { X } from "lucide-react"

import { ResultCard } from "@/components/search/result-card.tsx"
import { Button } from "@/components/ui/button"
import type { PackageSummary } from "@/shared/registry.ts"

function PinnedCard({
  onRemove,
  summary,
  workspaceName,
}: {
  onRemove: () => void
  summary: PackageSummary
  workspaceName: string
}) {
  return (
    <li className="grid gap-1">
      <ResultCard result={summary} />
      <Button
        aria-label={`Remove ${summary.name} from ${workspaceName}`}
        className="justify-self-end"
        data-remove-pin=""
        onClick={onRemove}
        size="xs"
        variant="ghost"
      >
        <X aria-hidden />
        Remove
      </Button>
    </li>
  )
}

export { PinnedCard }
