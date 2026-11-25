import { createContext, use } from "react"

interface Copied {
  // The install command copied last, shown as "Copied" on its card.
  copied: string | null
  copy: (install: string) => void
}

const CopiedContext = createContext<Copied | null>(null)

function useCopied(): Copied {
  const value = use(CopiedContext)
  if (value === null) {
    throw new Error("useCopied needs a CopiedProvider")
  }
  return value
}

export { CopiedContext, useCopied }
export type { Copied }
