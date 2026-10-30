import { useEffect, useState } from "react"

export function useDebouncedValue<T>(
  value: T,
  delayMs = 200
): [T, (next: T) => void] {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return [debounced, setDebounced]
}
