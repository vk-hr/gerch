import { Check, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"

import { useCopied } from "./copied-context.ts"

function CopyInstallButton({ install }: { install: string }) {
  const { copied, copy } = useCopied()
  const isCopied = copied === install
  return (
    <Button
      className="ml-auto font-heading"
      onClick={() => {
        copy(install)
      }}
      size="xs"
      variant="outline"
    >
      {isCopied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {isCopied ? "Copied" : install}
    </Button>
  )
}

export { CopyInstallButton }
