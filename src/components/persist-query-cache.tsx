import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import type { ReactElement } from "react"

import { persistQueryCache } from "@/client/query-persister.ts"

// Starts the IndexedDB query cache once the page has hydrated, so restored
// searches never change the markup React hydrates (D15, D27).
function PersistQueryCache({ children }: { children: ReactElement }) {
  const queryClient = useQueryClient()
  useEffect(() => persistQueryCache(queryClient), [queryClient])
  return children
}

export { PersistQueryCache }
