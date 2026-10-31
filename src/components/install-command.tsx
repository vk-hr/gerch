import { Button } from "@/components/ui/button"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"

export function InstallCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section aria-labelledby="installation-heading">
      <h2 id="installation-heading" className="text-sm font-medium">
        Installation
      </h2>
      <div className="mt-2 flex items-center gap-2 rounded-xl border bg-muted/50 px-3 py-2">
        <code className="min-w-0 flex-1 truncate text-sm">{command}</code>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          aria-label={
            copied ? "Install command copied" : "Copy install command"
          }
        >
          {copied ? (
            <CheckIcon data-icon="inline-start" />
          ) : (
            <CopyIcon data-icon="inline-start" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </section>
  )
}
