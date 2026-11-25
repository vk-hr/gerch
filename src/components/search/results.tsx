import { useSuspenseQuery } from "@tanstack/react-query"

import { searchQuery } from "@/lib/search.ts"
import type { Registry } from "@/shared/registry.ts"

import { ResultCard } from "./result-card.tsx"
import { SearchFailed } from "./search-failed.tsx"

function Results({ registry, text }: { registry: Registry; text: string }) {
  const { data, refetch } = useSuspenseQuery(searchQuery(registry, text))
  if (!data.ok) {
    return (
      <SearchFailed
        message={data.message}
        onRetry={() => {
          void refetch()
        }}
      />
    )
  }
  if (data.body.results.length === 0) {
    return <p className="text-sm text-muted-foreground">No packages match.</p>
  }
  return (
    <div className="grid gap-3">
      {data.body.results.map((result) => (
        <ResultCard key={result.name} result={result} />
      ))}
    </div>
  )
}

export { Results }
