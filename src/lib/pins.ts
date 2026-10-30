import { listPins } from "@/server/pins"
import { queryOptions } from "@tanstack/react-query"

export const pinsQueryOptions = queryOptions({
  queryKey: ["pins"],
  queryFn: () => listPins(),
})
