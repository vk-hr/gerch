// Sends web-vitals samples to /api/vitals (D18). The library loads after the
// page is idle, so it never counts toward a cold entry. Each sample carries
// the route template, not the URL, and only the allowed attribution fields.
import { ATTRIBUTION_KEYS } from "@/shared/vitals.ts"
import type { VitalName, VitalSample } from "@/shared/vitals.ts"

interface Metric {
  name: VitalName
  value: number
  rating: VitalSample["rating"]
  navigationType: string
  attribution: object
}

function sample(metric: Metric, route: VitalSample["route"]): VitalSample {
  const attribution = Object.fromEntries(
    Object.entries(metric.attribution).filter(
      ([key, value]) =>
        ATTRIBUTION_KEYS[metric.name].includes(key) &&
        (typeof value === "number" || typeof value === "string")
    )
  )
  return {
    attribution,
    name: metric.name,
    navigationType: metric.navigationType,
    rating: metric.rating,
    route,
    value: metric.value,
  }
}

// `route` gives the current route template, or null to send nothing.
async function startVitals(
  route: () => VitalSample["route"] | null
): Promise<void> {
  const { onCLS, onFCP, onINP, onLCP, onTTFB } =
    await import("web-vitals/attribution")
  const send = (metric: Metric) => {
    const template = route()
    if (template === null) {
      return
    }
    const body = JSON.stringify(sample(metric, template))
    navigator.sendBeacon("/api/vitals", body)
  }
  for (const on of [onCLS, onFCP, onINP, onLCP, onTTFB]) {
    on(send)
  }
}

export { sample, startVitals }
