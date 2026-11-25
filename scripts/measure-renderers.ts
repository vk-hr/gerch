// Compares the browser renderers on one commit (performance directive, D34):
// builds with React DOM and with Redact, serves each on recorded fixtures,
// and measures in Chromium with 4x CPU and network throttling:
//   - cold entry: navigation start to the first result shown and the page
//     answering keys (body[data-interactive]);
//   - warm navigation: Enter on a result to the package page's heading;
//   - typing: the longest event of each key press while typing a query.
// `bun scripts/measure-renderers.ts [rounds]`. Writes Chromium traces of one
// cold entry per renderer to test-results/.
import { chromium } from "@playwright/test"
import type { Browser, Page } from "@playwright/test"

import { observed, throttledPage, timeWhen } from "./perf-page.ts"

const RENDERERS = ["react-dom", "redact"] as const
const ROUNDS_ARG = 2
const DEFAULT_ROUNDS = 7
const PORT = 4310
const TYPED = "react query"
const KEY_DELAY_MS = 60
const SETTLE_MS = 1000
const READY_TRIES = 100
const READY_WAIT_MS = 100
const P50 = 50
const P75 = 75
const PERCENT = 100

interface Round {
  coldMs: number
  lcpMs: number
  navigationMs: number
  typingWorstMs: number
}

// Nearest-rank percentile.
function percentile(values: readonly number[], at: number): number | null {
  if (values.length === 0) {
    return null
  }
  const sorted = values.toSorted((left, right) => left - right)
  const rank = Math.ceil((at / PERCENT) * sorted.length)
  return sorted[Math.max(rank, 1) - 1] ?? null
}

// One duration per interaction: its longest event, as INP counts it. Events
// without an interaction id (0) aren't interactions.
function interactionDurations(
  events: readonly { duration: number; interactionId: number }[]
): number[] {
  const longest = new Map<number, number>()
  for (const { duration, interactionId } of events) {
    if (interactionId !== 0) {
      longest.set(
        interactionId,
        Math.max(longest.get(interactionId) ?? 0, duration)
      )
    }
  }
  return [...longest.values()]
}

async function run(cmd: string[], env: Record<string, string>): Promise<void> {
  const proc = Bun.spawn(cmd, {
    env: { ...process.env, ...env },
    stderr: "inherit",
    stdout: "ignore",
  })
  if ((await proc.exited) !== 0) {
    throw new Error(`${cmd.join(" ")} failed`)
  }
}

async function waitForServer(base: string, tries = READY_TRIES): Promise<void> {
  try {
    await fetch(base)
  } catch (error) {
    if (tries === 0) {
      throw error
    }
    await Bun.sleep(READY_WAIT_MS)
    await waitForServer(base, tries - 1)
  }
}

// Until the first npm result is visible and the hotkeys are registered.
async function coldEntry(page: Page, base: string) {
  await page.goto(`${base}/?q=zod`, { waitUntil: "commit" })
  const coldMs = await timeWhen(page, () =>
    document.querySelector("section[aria-label='npm'] article") !== null &&
    document.body.dataset.interactive !== undefined
      ? performance.now()
      : false
  )
  const { lcp } = await observed(page)
  return { coldMs, lcpMs: lcp }
}

// From the Enter key press on the first result to the package heading.
async function warmNavigation(page: Page): Promise<number> {
  await page.getByRole("combobox", { name: "Search packages" }).focus()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
  const shownAt = await timeWhen(page, () =>
    document.querySelector("main h1")?.textContent === "zod"
      ? performance.now()
      : false
  )
  const { keydownAt } = await observed(page)
  return shownAt - keydownAt
}

// The longest interaction while typing a query into the search box.
async function typing(page: Page, base: string): Promise<number> {
  await page.goto(`${base}/`)
  await page.locator("body[data-interactive]").waitFor({ state: "attached" })
  await page.keyboard.press("/")
  await page.keyboard.type(TYPED, { delay: KEY_DELAY_MS })
  await page.waitForTimeout(SETTLE_MS)
  const { events } = await observed(page)
  return Math.max(0, ...interactionDurations(events))
}

async function round(browser: Browser, base: string): Promise<Round> {
  const page = await throttledPage(browser)
  const { coldMs, lcpMs } = await coldEntry(page, base)
  const navigationMs = await warmNavigation(page)
  const typingWorstMs = await typing(page, base)
  await page.context().close()
  return { coldMs, lcpMs, navigationMs, typingWorstMs }
}

async function traceColdEntry(
  browser: Browser,
  base: string,
  renderer: string
) {
  const page = await throttledPage(browser)
  await browser.startTracing(page, {
    path: `test-results/trace-cold-${renderer}.json`,
    screenshots: true,
  })
  await coldEntry(page, base)
  await browser.stopTracing()
  await page.context().close()
}

// The production build on recorded fixtures, with no database: Bun would
// otherwise load DATABASE_URL from .env.local (D30).
function startServer() {
  return Bun.spawn(["bun", ".output/server/index.mjs"], {
    env: {
      ...process.env,
      DATABASE_URL: "",
      GERCH_REPLAY_DIR: "test/fixtures",
      PORT: String(PORT),
    },
    stdout: "ignore",
  })
}

async function rounds(browser: Browser, base: string, count: number) {
  // One unmeasured round warms the server.
  await round(browser, base)
  return Array.from({ length: count }).reduce<Promise<Round[]>>(
    async (previous) => [...(await previous), await round(browser, base)],
    Promise.resolve([])
  )
}

async function measure(renderer: string, count: number): Promise<Round[]> {
  // Any value but "react-dom" builds the default, Redact.
  await run(["bun", "run", "build"], { GERCH_RENDERER: renderer })
  return serve(async (browser, base) => {
    const results = await rounds(browser, base, count)
    await traceColdEntry(browser, base, renderer)
    return results
  })
}

// Runs `measured` against the current build, then stops browser and server.
async function serve<TResult>(
  measured: (browser: Browser, base: string) => Promise<TResult>
): Promise<TResult> {
  const server = startServer()
  const browser = await chromium.launch()
  try {
    const base = `http://localhost:${PORT}`
    await waitForServer(base)
    return await measured(browser, base)
  } finally {
    await browser.close()
    server.kill()
  }
}

function summary(renderer: string, results: readonly Round[]) {
  const pick = (key: keyof Round, at: number) =>
    Math.round(
      percentile(
        results.map((result) => result[key]),
        at
      ) ?? 0
    )
  return {
    "cold entry p50 ms": pick("coldMs", P50),
    "cold entry p75 ms": pick("coldMs", P75),
    "LCP p50 ms": pick("lcpMs", P50),
    "navigation p50 ms": pick("navigationMs", P50),
    "navigation p75 ms": pick("navigationMs", P75),
    renderer,
    "typing worst p50 ms": pick("typingWorstMs", P50),
    "typing worst p75 ms": pick("typingWorstMs", P75),
  }
}

async function main(): Promise<void> {
  const count = Number(Bun.argv[ROUNDS_ARG] ?? DEFAULT_ROUNDS)
  const results = await RENDERERS.reduce<Promise<ReturnType<typeof summary>[]>>(
    async (previous, renderer) => [
      ...(await previous),
      summary(renderer, await measure(renderer, count)),
    ],
    Promise.resolve([])
  )
  console.table(results)
  // Leave the default build in .output.
  await run(["bun", "run", "build"], {})
}

if (import.meta.main) {
  await main()
}

export { interactionDurations, percentile }
