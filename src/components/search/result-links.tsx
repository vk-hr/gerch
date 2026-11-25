import { GitBranch, House } from "lucide-react"

import type { PackageSummary } from "@/shared/registry.ts"

const LINK_CLASS = "inline-flex items-center gap-1 hover:text-foreground"

function ResultLinks({
  result,
}: {
  result: Pick<PackageSummary, "homepage" | "repository">
}) {
  return (
    <>
      {result.repository === null ? null : (
        <a className={LINK_CLASS} href={result.repository}>
          <GitBranch aria-hidden className="size-3.5" />
          repository
        </a>
      )}
      {result.homepage === null ? null : (
        <a className={LINK_CLASS} href={result.homepage}>
          <House aria-hidden className="size-3.5" />
          homepage
        </a>
      )}
    </>
  )
}

export { ResultLinks }
