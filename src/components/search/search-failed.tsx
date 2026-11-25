import { Button } from "@/components/ui/button"

function SearchFailed({
  message,
  onRetry,
  retrying,
}: {
  message: string
  onRetry: () => void
  retrying: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-destructive/30 p-4 text-sm">
      <span>{message}</span>
      <Button disabled={retrying} onClick={onRetry} size="xs" variant="outline">
        {retrying ? "Retrying…" : "Retry"}
      </Button>
    </div>
  )
}

export { SearchFailed }
