import type { Registry } from "@/server/registries/record"

import { Toggle } from "@/components/ui/toggle"
import { pinsQueryOptions } from "@/lib/pins"
import { addPin, removePin } from "@/server/pins"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PinIcon, PinOffIcon } from "lucide-react"

export function PinToggle({
  registry,
  name,
}: {
  registry: Registry
  name: string
}) {
  const queryClient = useQueryClient()
  const pins = useQuery(pinsQueryOptions)
  const pinned = (pins.data ?? []).some(
    (pin) => pin.registry === registry && pin.name === name
  )

  async function toggle() {
    if (pinned) {
      await removePin({ data: { registry, name } })
    } else {
      await addPin({ data: { registry, name } })
    }
    await queryClient.invalidateQueries({ queryKey: pinsQueryOptions.queryKey })
  }

  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={pinned}
      onPressedChange={() => void toggle()}
      aria-label={pinned ? "Unpin package" : "Pin package"}
      title={pinned ? "Unpin package" : "Pin package"}
      className="size-7 px-0"
    >
      {pinned ? <PinOffIcon /> : <PinIcon />}
    </Toggle>
  )
}
