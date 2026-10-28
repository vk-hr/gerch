import type { Registry } from "@/server/registries/record"

import { addPin, listPins, removePin } from "@/server/pins"
import { useQuery, useQueryClient } from "@tanstack/react-query"

export function PinToggle({
  registry,
  name,
}: {
  registry: Registry
  name: string
}) {
  const queryClient = useQueryClient()
  const pins = useQuery({ queryKey: ["pins"], queryFn: () => listPins() })
  const pinned = (pins.data ?? []).some(
    (pin) => pin.registry === registry && pin.name === name
  )

  async function toggle() {
    if (pinned) {
      await removePin({ data: { registry, name } })
    } else {
      await addPin({ data: { registry, name } })
    }
    await queryClient.invalidateQueries({ queryKey: ["pins"] })
  }

  return (
    <button
      onClick={toggle}
      aria-pressed={pinned}
      className="mt-4 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
    >
      {pinned ? "Unpin" : "Pin"}
    </button>
  )
}
