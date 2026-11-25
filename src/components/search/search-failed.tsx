import { Button } from "@/components/ui/button"

function SearchFailed({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-destructive/30 p-4 text-sm">
      <span>{message}</span>
      <Button onClick={onRetry} size="xs" variant="outline">
        Retry
      </Button>
    </div>
  )
}

export { SearchFailed }
