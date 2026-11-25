import { useState } from "react"
import type { ReactNode } from "react"

import { CopiedContext } from "./copied-context.ts"

const RESET_MS = 1500

async function writeClipboard(install: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(install)
    return true
  } catch (error) {
    console.warn("Copying the install command failed", error)
    return false
  }
}

function CopiedProvider({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState<string | null>(null)
  const markCopied = (install: string) => {
    setCopied(install)
    setTimeout(() => {
      setCopied((current) => (current === install ? null : current))
    }, RESET_MS)
  }
  const copyAndMark = async (install: string) => {
    if (await writeClipboard(install)) {
      markCopied(install)
    }
  }
  const copy = (install: string) => {
    void copyAndMark(install)
  }
  return <CopiedContext value={{ copied, copy }}>{children}</CopiedContext>
}

export { CopiedProvider }
