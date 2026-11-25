import { expect, test } from "@playwright/test"
import type { Page, Request } from "@playwright/test"

import { firstResult } from "./support.ts"

// The recorded crates.io search for serde, in registry order.
const SERDE_RESULTS = [
  "serde",
  "serde-saphyr",
  "clickhouse",
  "serde_yml",
  "serde_valid",
  "serde_toon_format",
  "serde_json",
  "yaml_serde",
  "serde_json_borrow",
  "rust_decimal",
]

// The crate a package lookup (a server function call with a `name`) asks
// for, or null for any other request.
function lookedUp(request: Request): string | null {
  const url = new URL(request.url())
  const payload = url.searchParams.get("payload") ?? ""
  if (!url.pathname.includes("/_serverFn/") || !payload.includes('"name"')) {
    return null
  }
  return SERDE_RESULTS.find((name) => payload.includes(`"${name}"`)) ?? null
}

// Records the crates the page looks up, in order, and the most lookups in
// flight at once.
function trackLookups(page: Page) {
  const tracked = { lookups: new Array<string>(), most: 0, open: 0 }
  page.on("request", (request) => {
    const name = lookedUp(request)
    if (name !== null) {
      tracked.lookups.push(name)
      tracked.open += 1
      tracked.most = Math.max(tracked.most, tracked.open)
    }
  })
  page.on("requestfinished", (request) => {
    if (lookedUp(request) !== null) {
      tracked.open -= 1
    }
  })
  return tracked
}

// The first serde card: its search fields, then the license it loads.
async function expectSerdeCard(page: Page) {
  const serde = firstResult(page, "crates.io")
  await expect(serde.getByRole("heading")).toHaveText("serde")
  await expect(serde).toContainText("cargo add serde")
  await expect(serde).toContainText("462M/90d")
  await expect(serde).toContainText("MIT OR Apache-2.0")
}

test("crate:serde fills each license in result order, one at a time", async ({
  page,
}) => {
  const tracked = trackLookups(page)
  await page.goto("/?q=crate:serde")
  await expectSerdeCard(page)
  const crates = page.getByRole("region", { name: "crates.io" })
  await expect(crates.getByRole("article").last()).toContainText("MIT")
  expect(tracked.lookups).toStrictEqual(SERDE_RESULTS)
  expect(tracked.most).toBe(1)
  await expect(page.getByRole("region", { name: "npm" })).toHaveCount(0)
})

test("a crate page renders on the server with its license", async ({
  page,
  request,
}) => {
  const response = await request.get("/p/crate/serde")
  expect(response.ok()).toBe(true)
  const html = await response.text()
  expect(html).toContain("cargo add serde")
  expect(html).toContain("MIT OR Apache-2.0")
  expect(html).toContain("1.0.229")
  await page.goto("/p/crate/serde")
  const main = page.getByRole("main")
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("serde")
  await expect(main.locator("time")).toHaveText("2026-07-18")
})

test("crates screenshot", async ({ page }, testInfo) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto("/?q=crate:serde")
  const crates = page.getByRole("region", { name: "crates.io" })
  await expect(crates.getByRole("article").last()).toContainText("MIT")
  await page.screenshot({
    fullPage: false,
    path: testInfo.outputPath("crates.png"),
  })
})
