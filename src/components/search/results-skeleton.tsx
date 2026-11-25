const ROWS = ["first", "second", "third"] as const

function ResultsSkeleton() {
  return (
    <div aria-busy className="grid gap-3">
      {ROWS.map((row) => (
        <div className="h-24 animate-pulse rounded-xl bg-muted" key={row} />
      ))}
    </div>
  )
}

export { ResultsSkeleton }
