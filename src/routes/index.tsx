import type { NixChannel } from "@/server/registries/nix"
import type { Registry } from "@/server/registries/record"

import { PackageCard } from "@/components/PackageCard"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { useNixChannel } from "@/hooks/useNixChannel"
import { PAGE_SIZE, REGISTRIES, searchRegistry } from "@/lib/search"
import { useHotkey } from "@tanstack/react-hotkeys"
import { useInfiniteQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useEffect, useRef, useState } from "react"

export const Route = createFileRoute("/")({ component: SearchPage })

function SearchPage() {
  const [registry, setRegistry] = useState<Registry>("npm")
  const [channel, setChannel] = useNixChannel()
  const [input, setInput] = useState("")
  const [q, flush] = useDebouncedValue(input, 200)
  const [highlighted, setHighlighted] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const navigate = Route.useNavigate()

  const search = useInfiniteQuery({
    queryKey: ["search", registry, q, registry === "nix" ? channel : undefined],
    queryFn: ({ pageParam }) =>
      searchRegistry({
        registry,
        q,
        offset: pageParam,
        channel: channel,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.records.length === PAGE_SIZE
        ? allPages.length * PAGE_SIZE
        : undefined,
    enabled: q.trim().length > 0,
  })

  const records = search.data?.pages.flatMap((page) => page.records) ?? []
  const degraded = search.data?.pages.some((page) => page.degraded) ?? false

  const virtualizer = useVirtualizer({
    count: records.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 88,
    overscan: 5,
    measureElement: (element) => element.getBoundingClientRect().height,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const lastItem = virtualItems[virtualItems.length - 1]
  useEffect(() => {
    if (
      lastItem &&
      lastItem.index >= records.length - 5 &&
      search.hasNextPage &&
      !search.isFetchingNextPage
    ) {
      void search.fetchNextPage()
    }
  }, [
    lastItem,
    records.length,
    search.hasNextPage,
    search.isFetchingNextPage,
    search.fetchNextPage,
  ])

  useHotkey("Mod+K", (event) => {
    event.preventDefault()
    inputRef.current?.focus()
  })

  async function onEnter() {
    const trimmed = input.trim()
    if (trimmed && !trimmed.includes(" ") && !trimmed.includes(":")) {
      const result = await searchRegistry({
        registry,
        q: trimmed,
        offset: 0,
        channel: channel,
      })
      const exact = result.records.find(
        (record) => record.name.toLowerCase() === trimmed.toLowerCase()
      )
      if (exact) {
        await navigate({
          to: "/$registry/$name",
          params: { registry, name: encodeURIComponent(exact.name) },
        })
        return
      }
    }

    flush(input)
    const record = records[highlighted]
    if (record) {
      await navigate({
        to: "/$registry/$name",
        params: {
          registry: record.registry,
          name: encodeURIComponent(record.name),
        },
      })
    }
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.currentTarget.blur()
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlighted((index) => Math.min(index + 1, records.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlighted((index) => Math.max(index - 1, 0))
    } else if (event.key === "Enter") {
      event.preventDefault()
      void onEnter()
    }
  }

  return (
    <div className="mx-auto flex h-svh max-w-3xl flex-col gap-4 p-6">
      <div className="flex flex-col gap-3">
        <div className="flex gap-1" role="tablist" aria-label="Registry">
          {REGISTRIES.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={registry === item.id}
              onClick={() => {
                setRegistry(item.id)
                setHighlighted(0)
                inputRef.current?.focus()
              }}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                registry === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {item.label}
            </button>
          ))}
          {registry === "nix" && (
            <select
              value={channel}
              onChange={(event) => setChannel(event.target.value as NixChannel)}
              aria-label="Nix channel"
              className="ml-auto rounded-md border bg-card px-2 py-1.5 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="nixos-unstable">unstable</option>
              <option value="nixos-26.05">26.05</option>
            </select>
          )}
        </div>
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setHighlighted(0)
          }}
          onKeyDown={onInputKeyDown}
          placeholder={`Search ${REGISTRIES.find((item) => item.id === registry)?.label} packages`}
          aria-label="Search packages"
          autoFocus
          className="w-full rounded-md border bg-card px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {degraded && (
        <div role="status" className="rounded-md border px-3 py-2 text-sm">
          nixpkgs search is unavailable right now. Results may be missing.
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {q.trim().length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Type to search. Mod+K focuses the search box, Enter opens an exact
            match.
          </p>
        ) : search.isLoading ? (
          <p className="text-sm text-muted-foreground">Searching…</p>
        ) : search.isError ? (
          <p role="alert" className="text-sm">
            Search failed: {search.error.message}
          </p>
        ) : records.length === 0 && !degraded ? (
          <p className="text-sm text-muted-foreground">
            No packages found for “{q}”.
          </p>
        ) : (
          <div
            style={{ height: virtualizer.getTotalSize(), position: "relative" }}
          >
            {virtualItems.map((item) => {
              const record = records[item.index]
              return (
                <div
                  key={item.key}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <PackageCard
                    record={record}
                    highlighted={item.index === highlighted}
                  />
                </div>
              )
            })}
          </div>
        )}
        {search.isFetchingNextPage && (
          <p className="py-2 text-sm text-muted-foreground">Loading more…</p>
        )}
      </div>
    </div>
  )
}
