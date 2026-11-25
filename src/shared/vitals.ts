// Field vitals (D18): what the browser sends to POST /api/vitals. Shared so
// the browser only sends what the server keeps.
const VITAL_NAMES = ["CLS", "FCP", "INP", "LCP", "TTFB"] as const

type VitalName = (typeof VITAL_NAMES)[number]

// Route templates, never URLs: a URL can hold the search text.
const ROUTE_TEMPLATES = ["/", "/p/$registry/$name"] as const

// The attribution fields kept per metric: timings, element selectors and
// load state. URLs and raw performance entries stay in the browser.
const ATTRIBUTION_KEYS: Record<VitalName, readonly string[]> = {
  CLS: ["largestShiftTarget", "largestShiftValue", "loadState"],
  FCP: ["firstByteToFCP", "loadState", "timeToFirstByte"],
  INP: [
    "inputDelay",
    "interactionTarget",
    "interactionType",
    "loadState",
    "presentationDelay",
    "processingDuration",
  ],
  LCP: [
    "elementRenderDelay",
    "resourceLoadDelay",
    "resourceLoadDuration",
    "target",
    "timeToFirstByte",
  ],
  TTFB: [
    "cacheDuration",
    "connectionDuration",
    "dnsDuration",
    "requestDuration",
    "waitingDuration",
  ],
}

interface VitalSample {
  name: VitalName
  value: number
  rating: "good" | "needs-improvement" | "poor"
  navigationType: string
  route: (typeof ROUTE_TEMPLATES)[number]
  attribution: Record<string, string | number>
}

export { ATTRIBUTION_KEYS, ROUTE_TEMPLATES, VITAL_NAMES }
export type { VitalName, VitalSample }
