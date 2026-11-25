import { useRouter } from "@tanstack/react-router"
import { useEffect } from "react"

import { startVitals } from "@/client/vitals.ts"
import { ROUTE_TEMPLATES } from "@/shared/vitals.ts"
import type { VitalSample } from "@/shared/vitals.ts"

function isTemplate(
  routeId: string | undefined
): routeId is VitalSample["route"] {
  return ROUTE_TEMPLATES.some((template) => template === routeId)
}

// Starts field vitals once the browser is idle after hydration (D18).
function VitalsReporter() {
  const router = useRouter()
  useEffect(() => {
    const currentRoute = () => {
      const routeId = router.state.matches.at(-1)?.routeId
      return isTemplate(routeId) ? routeId : null
    }
    const idle = requestIdleCallback(() => {
      void startVitals(currentRoute)
    })
    return () => {
      cancelIdleCallback(idle)
    }
  }, [router])
  return null
}

export { VitalsReporter }
