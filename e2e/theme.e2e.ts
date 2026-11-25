import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

const html = (page: Page) => page.locator("html")

test.describe("on a dark system", () => {
  test.use({ colorScheme: "dark" })

  test("the page is dark from the first paint", async ({ page }) => {
    // No module script loads, so React never runs: only the inline
    // bootstrap script in the server HTML can set the class.
    await page.route("**/assets/*.js", async (route) => route.abort())
    await page.goto("/?q=zod")
    await expect(html(page)).toHaveClass(/\bdark\b/u)
    await expect(html(page)).toHaveCSS("color-scheme", "dark")
  })
})

test.describe("on a light system", () => {
  test.use({ colorScheme: "light" })

  test("the page follows a change of system theme", async ({ page }) => {
    await page.goto("/p/npm/zod")
    await expect(page.locator("body[data-interactive]")).toBeAttached()
    await expect(html(page)).toHaveClass(/\blight\b/u)
    await page.emulateMedia({ colorScheme: "dark" })
    await expect(html(page)).toHaveClass(/\bdark\b/u)
    await expect(html(page)).not.toHaveClass(/\blight\b/u)
  })
})

// The router stamps each render with the time (epoch milliseconds).
const withoutTimes = (page: string) => page.replaceAll(/\b1\d{12}\b/gu, "")

// The CDN caches HTML without looking at cookies (D29), so the server must
// render the same page for everyone.
test("the server renders one page for every visitor", async ({ request }) => {
  const plain = await request.get("/p/npm/zod")
  const withCookie = await request.get("/p/npm/zod", {
    headers: { cookie: "theme=dark" },
  })
  expect(withoutTimes(await withCookie.text())).toBe(
    withoutTimes(await plain.text())
  )
  expect(await plain.text()).not.toMatch(/<html[^>]*class=/u)
})

test("dark screenshot", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto("/?q=zod")
  await expect(
    page.getByRole("region", { name: "npm" }).getByRole("article").first()
  ).toBeVisible()
  await page.screenshot({
    fullPage: false,
    path: testInfo.outputPath("dark.png"),
  })
})
