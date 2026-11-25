// In-page measurement helpers for scripts/measure-renderers.ts: a throttled
// Chromium page that records LCP, event timings and key presses.
import type { Browser, Page } from "@playwright/test"
import { z } from "zod"

const CPU_SLOWDOWN = 4
// Roughly a fast 4G connection.
const NETWORK = {
  downloadThroughput: 1_250_000,
  latency: 40,
  offline: false,
  uploadThroughput: 625_000,
}
const eventsSchema = z.array(
  z.object({ duration: z.number(), interactionId: z.number() })
)
const observedSchema = z.object({
  events: eventsSchema,
  keydownAt: z.number(),
  lcp: z.number(),
})

// Collects LCP, event timings and the last keydown's time in the page, for
// `observed` to read back. Playwright sends this function's source to the
// page on its own, so it can't use anything from this module.
function observe() {
  // Event timings of 16 ms and longer. `durationThreshold` is missing from
  // TypeScript's DOM types, so the options are a variable.
  const eventTimings = { durationThreshold: 16, type: "event" }
  const seen = { events: new Array<unknown>(), keydownAt: 0, lcp: 0 }
  Object.assign(globalThis, { gerchObserved: seen })
  new PerformanceObserver((list) => {
    seen.lcp = list.getEntries().at(-1)?.startTime ?? seen.lcp
  }).observe({ buffered: true, type: "largest-contentful-paint" })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry instanceof PerformanceEventTiming) {
        seen.events.push({
          duration: entry.duration,
          interactionId: entry.interactionId,
        })
      }
    }
  }).observe(eventTimings)
  document.addEventListener(
    "keydown",
    (event) => {
      seen.keydownAt = event.timeStamp
    },
    { capture: true }
  )
}

async function observed(page: Page) {
  const json = await page.evaluate(() =>
    JSON.stringify(Reflect.get(globalThis, "gerchObserved"))
  )
  return observedSchema.parse(JSON.parse(json))
}

async function throttledPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    viewport: { height: 900, width: 1280 },
  })
  await context.addInitScript(observe)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN })
  await cdp.send("Network.enable")
  await cdp.send("Network.emulateNetworkConditions", NETWORK)
  return page
}

// Runs `readyAt` in the page every animation frame until it returns the
// page's clock (ms since navigation start) instead of false.
async function timeWhen(
  page: Page,
  readyAt: () => number | false
): Promise<number> {
  const handle = await page.waitForFunction(readyAt, undefined, {
    polling: "raf",
  })
  return Number(await handle.jsonValue())
}

export { observed, throttledPage, timeWhen }
