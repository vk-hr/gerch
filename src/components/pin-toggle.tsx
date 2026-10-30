import type { Registry } from "@/server/registries/record"

import { Toggle } from "@/components/ui/toggle"
import { addPin, listPins, removePin } from "@/server/pins"
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
    <Toggle
      variant="outline"
      pressed={pinned}
      onPressedChange={() => void toggle()}
      className="mt-4"
    >
      {pinned ? (
        <PinOffIcon data-icon="inline-start" />
      ) : (
        <PinIcon data-icon="inline-start" />
      )}
      {pinned ? "Unpin" : "Pin"}
    </Toggle>
  )
}
