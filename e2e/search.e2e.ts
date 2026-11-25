import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

async function interactive(page: Page, url: string) {
  await page.goto(url)
  await expect(page.locator("body[data-interactive]")).toBeAttached()
}

const firstResult = (page: Page, registry: string) =>
  page.getByRole("region", { name: registry }).getByRole("article").first()

test("the home page answers without a redirect", async ({ request }) => {
  const response = await request.get("/", { maxRedirects: 0 })
  expect(response.ok()).toBe(true)
})

test("Escape clears the query and the URL", async ({ page }) => {
  await interactive(page, "/?q=zod")
  await page.getByRole("combobox", { name: "Search packages" }).focus()
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("combobox", { name: "Search packages" })
  ).toHaveValue("")
  await expect(page).toHaveURL(/\/$/u)
})

test("a direct link renders npm results on the server", async ({
  page,
  request,
}) => {
  const response = await request.get("/?q=zod")
  const html = await response.text()
  expect(html).toContain("npm i zod")

  await page.goto("/?q=zod")
  await expect(firstResult(page, "npm").getByRole("heading")).toHaveText("zod")
  await expect(
    page.getByRole("combobox", { name: "Search packages" })
  ).toHaveValue("zod")
})

async function typeWithIntermediateSearch(page: Page) {
  await page.keyboard.type("npm:rea")
  await expect(page.getByRole("region", { name: "npm" })).toContainText(
    "npm is unavailable"
  )
  await page.keyboard.type("ct query")
}

test("typing a prefixed query searches only that registry", async ({
  page,
}) => {
  await interactive(page, "/")
  await page.keyboard.press("/")
  await expect(
    page.getByRole("combobox", { name: "Search packages" })
  ).toBeFocused()
  const search = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (
      url.pathname.includes("/_serverFn/") &&
      url.searchParams.get("payload")?.includes('"react query"') === true
    )
  })
  await typeWithIntermediateSearch(page)
  await expect(page).toHaveURL(/q=npm%3Areact(?:\+|%20)query/u)
  const response = await search
  expect(response.headers()["cache-control"]).toContain("s-maxage")
  await expect(firstResult(page, "npm").getByRole("heading")).toHaveText(
    "@trpc/tanstack-react-query"
  )
  await expect(page.getByRole("region", { name: "crates.io" })).toHaveCount(0)
})

test("arrow keys move through results and Alt+C copies the install command", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await interactive(page, "/?q=zod")
  // Streamed results reach the page hidden; React reveals them up to 300 ms
  // later (docs/decisions.md D23). Users press keys once they see results.
  await expect(firstResult(page, "npm")).toBeVisible()
  await page.getByRole("combobox", { name: "Search packages" }).focus()
  await page.keyboard.press("ArrowDown")
  await expect(firstResult(page, "npm")).toBeFocused()
  await page.keyboard.press("Alt+C")
  await expect(firstResult(page, "npm").getByText("Copied")).toBeVisible()
  expect(await page.evaluate(async () => navigator.clipboard.readText())).toBe(
    "npm i zod"
  )
})

test("a failing registry shows its own error and leaves the page usable", async ({
  page,
}) => {
  await page.goto("/?q=npm:no-recorded-fixture")
  const npm = page.getByRole("region", { name: "npm" })
  await expect(npm).toContainText("npm is unavailable")
  await expect(
    page.getByRole("combobox", { name: "Search packages" })
  ).toBeEditable()
})

// Crawlers get the whole page in one response instead of a stream, so the
// page's headers are written after the searches finish.
test("a search's cache headers stay off the page", async ({ request }) => {
  const crawler = { "user-agent": "Googlebot/2.1" }
  const found = await request.get("/?q=zod", { headers: crawler })
  expect(await found.text()).toContain("npm i zod")
  expect(found.headers()["cache-control"] ?? "").not.toContain("s-maxage")
  const failed = await request.get("/?q=npm:no-recorded-fixture", {
    headers: crawler,
  })
  expect(failed.headers()["cache-control"] ?? "").not.toBe("no-store")
})

test("a search request that never reaches the server can be retried", async ({
  page,
}) => {
  await interactive(page, "/")
  await page.route("**/_serverFn/**", async (route) => route.abort())
  await page.getByRole("combobox", { name: "Search packages" }).fill("npm:zod")
  const npm = page.getByRole("region", { name: "npm" })
  await expect(npm).toContainText("npm is unavailable")
  await page.unroute("**/_serverFn/**")
  await npm.getByRole("button", { name: "Retry" }).click()
  await expect(firstResult(page, "npm").getByRole("heading")).toHaveText("zod")
})

test("a search without a prefix covers npm and crates.io", async ({ page }) => {
  await page.goto("/?q=zod")
  await expect(firstResult(page, "crates.io").getByRole("heading")).toHaveText(
    "zod"
  )
  await expect(page.getByRole("region", { name: "nixpkgs" })).toContainText(
    "coming soon"
  )
})

test("search screenshot", async ({ page }, testInfo) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto("/?q=zod")
  await expect(firstResult(page, "npm").getByRole("heading")).toHaveText("zod")
  await page.screenshot({
    fullPage: false,
    path: testInfo.outputPath("search.png"),
  })
})
