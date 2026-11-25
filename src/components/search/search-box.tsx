import { Search } from "lucide-react"
import type { Ref } from "react"

function SearchBox({
  onChange,
  ref,
  value,
}: {
  onChange: (value: string) => void
  ref: Ref<HTMLInputElement>
  value: string
}) {
  return (
    <label className="relative flex-1">
      <span className="sr-only">Search packages</span>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        autoComplete="off"
        className="h-10 w-full rounded-xl border border-input bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        onChange={(event) => {
          onChange(event.target.value)
        }}
        placeholder="Search npm, crates.io, nixpkgs — npm:zod, crate:serde, nix:ripgrep"
        ref={ref}
        spellCheck={false}
        type="search"
        value={value}
      />
    </label>
  )
}

export { SearchBox }
