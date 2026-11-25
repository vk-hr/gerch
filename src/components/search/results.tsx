import { useSuspenseQuery } from "@tanstack/react-query"

import { searchQuery } from "@/lib/search.ts"
import type { Registry } from "@/shared/registry.ts"

import { ResultCard } from "./result-card.tsx"
import { SearchFailed } from "./search-failed.tsx"
import { useLazyLicenses } from "./use-lazy-licenses.ts"

function Results({ registry, text }: { registry: Registry; text: string }) {
  const { data, error, isFetching, refetch } = useSuspenseQuery(
    searchQuery(registry, text)
  )
  const message = data.ok ? error?.message : data.message
  const results = data.ok ? data.body.results : []
  const licenses = useLazyLicenses(results)
  return (
    <div className="grid gap-3">
      {message === undefined ? null : (
        <SearchFailed
          message={message}
          onRetry={() => {
            void refetch()
          }}
          retrying={isFetching}
        />
      )}
      {data.ok && data.body.results.length === 0 ? (
        <p className="text-sm text-muted-foreground">No packages match.</p>
      ) : null}
      {results.map((result) => (
        <ResultCard
          key={result.name}
          result={{
            ...result,
            license: result.license ?? licenses.get(result.name) ?? null,
          }}
        />
      ))}
    </div>
  )
}

export { Results }
