import type { NixChannel } from "@/lib/nix-channel"
import type { Registry } from "@/server/registries/record"

import { PackageCard } from "@/components/package-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useNixChannel } from "@/hooks/use-nix-channel"
import { PAGE_SIZE, REGISTRIES } from "@/lib/search"
import { searchPackages } from "@/server/search"
import { useHotkey } from "@tanstack/react-hotkeys"
import { useInfiniteQuery } from "@tanstack/react-query"
import {
  createFileRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router"
import { useVirtualizer } from "@tanstack/react-virtual"
import { RotateCcwIcon, SearchIcon, TriangleAlertIcon } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"

const NIX_CHANNELS: Array<{ value: NixChannel; label: string }> = [
  { value: "nixos-unstable", label: "unstable" },
  { value: "nixos-26.05", label: "26.05" },
]

export const Route = createFileRoute("/{-$query}")({
  component: SearchPage,
  errorComponent: SearchError,
})

function SearchError({ error, reset }: ErrorComponentProps) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="p-6">
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>Search failed</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
        <Button
          variant="outline"
          size="sm"
          onClick={reset}
          className="self-start"
        >
          <RotateCcwIcon data-icon="inline-start" />
          Retry
        </Button>
      </Alert>
    </div>
  )
}

function SearchPage() {
  const [registry, setRegistry] = useState<Registry>("npm")
  const [channel, setChannel] = useNixChannel()
  const { query } = Route.useParams()
  const input = query ?? ""
  const [q, flush] = useDebouncedValue(input, 200)
  const [highlighted, setHighlighted] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const navigate = Route.useNavigate()

  const search = useInfiniteQuery({
    queryKey: ["search", registry, q, registry === "nix" ? channel : undefined],
    queryFn: ({ pageParam }) =>
      searchPackages({
        data: {
          registry,
          q,
          offset: pageParam,
          channel,
        },
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

  useHotkey("Mod+K", () => {
    inputRef.current?.focus()
  })

  async function onEnter() {
    const trimmed = input.trim()
    if (trimmed && !trimmed.includes(" ") && !trimmed.includes(":")) {
      const result = await searchPackages({
        data: { registry, q: trimmed, offset: 0, channel },
      })
      const exact = result.records.find(
        (record) => record.name.toLowerCase() === trimmed.toLowerCase()
      )
      if (exact) {
        await navigate({
          to: "/$registry/$name",
          params: { registry, name: encodeURIComponent(exact.name) },
          search: registry === "nix" ? { channel } : undefined,
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
        search: record.registry === "nix" ? { channel } : undefined,
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
    <div className="flex h-svh flex-col p-6">
      <motion.div
        data-testid="search-layout"
        initial={false}
        animate={{ y: q.trim().length === 0 ? "25vh" : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="mx-auto flex w-full max-w-3xl flex-col gap-4"
      >
        <div className="flex flex-col gap-3">
          <div className="flex gap-1">
            <ToggleGroup
              aria-label="Registry"
              value={[registry]}
              onValueChange={(groupValue) => {
                const next = groupValue.at(-1)
                if (typeof next !== "string") return
                const match = REGISTRIES.find((item) => item.id === next)
                if (!match) return
                setRegistry(match.id)
                setHighlighted(0)
                inputRef.current?.focus()
              }}
            >
              {REGISTRIES.map((item) => (
                <ToggleGroupItem key={item.id} value={item.id}>
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {registry === "nix" && (
              <Select
                items={NIX_CHANNELS}
                value={channel}
                onValueChange={(value) => {
                  if (value === null) return
                  const match = NIX_CHANNELS.find(
                    (item) => item.value === value
                  )
                  if (!match) return
                  setChannel(match.value)
                }}
              >
                <SelectTrigger aria-label="Nix channel" className="ml-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {NIX_CHANNELS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </div>
          <Input
            ref={inputRef}
            value={input}
            onChange={(event) => {
              const value = event.target.value
              void navigate({
                to: "/{-$query}",
                params: { query: value || undefined },
                replace: true,
              })
              setHighlighted(0)
            }}
            onKeyDown={onInputKeyDown}
            placeholder={`Search ${
              REGISTRIES.find((item) => item.id === registry)?.label
            } packages`}
            aria-label="Search packages"
            autoFocus
          />
        </div>

        {degraded && (
          <Alert role="status">
            <TriangleAlertIcon />
            <AlertTitle>nixpkgs search is unavailable right now.</AlertTitle>
            <AlertDescription>Results may be missing.</AlertDescription>
          </Alert>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {q.trim().length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon />
                </EmptyMedia>
                <EmptyTitle>Search packages</EmptyTitle>
                <EmptyDescription>
                  Type to search. Mod+K focuses the search box, Enter opens an
                  exact match.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : search.isLoading ? (
            <div className="flex flex-col gap-2" aria-hidden>
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : search.isError ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>Search failed</AlertTitle>
              <AlertDescription>{search.error.message}</AlertDescription>
            </Alert>
          ) : records.length === 0 && !degraded ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon />
                </EmptyMedia>
                <EmptyTitle>No packages found</EmptyTitle>
                <EmptyDescription>
                  No packages found for “{q}”.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
              }}
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
                      channel={channel}
                    />
                  </div>
                )
              })}
            </div>
          )}
          {search.isFetchingNextPage && (
            <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Spinner />
              Loading more…
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
