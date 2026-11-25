import { expect, test } from "@playwright/test"

import { activeTab, focusFirstZodResult, tabLinks } from "./support.ts"

const NOT_FOUND = 404

test("a package page renders on the server with CDN cache headers", async ({
  request,
}) => {
  const response = await request.get("/p/npm/zod")
  expect(response.ok()).toBe(true)
  expect(response.headers()["cache-control"]).toBe(
    "public, s-maxage=3600, stale-while-revalidate=86400"
  )
  const html = await response.text()
  expect(html).toContain("npm i zod")
  expect(html).toContain("4.6.7")
})

test("a direct link shows the package without a release date", async ({
  page,
}) => {
  await page.goto("/p/npm/zod")
  const main = page.getByRole("main")
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("zod")
  await expect(main).toContainText("MIT")
  await expect(main).toContainText("469M/wk")
  await expect(main.getByRole("link", { name: "repository" })).toHaveAttribute(
    "href",
    "https://github.com/colinhacks/zod"
  )
  await expect(main.locator("time")).toHaveCount(0)
})

test("Enter opens the focused result in the current tab, with its release date", async ({
  page,
}) => {
  await focusFirstZodResult(page)
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/p\/npm\/zod$/u)
  const main = page.getByRole("main")
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("zod")
  await expect(main.locator("time")).toHaveText("2026-10-12")
  await expect(tabLinks(page)).toHaveText(["npm package zod"])
  await expect(activeTab(page)).toHaveText("npm package zod")
})

test("a scoped package has its own page", async ({ page }) => {
  await page.goto("/p/npm/%40trpc%2Ftanstack-react-query")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "@trpc/tanstack-react-query"
  )
  await expect(page.getByRole("main")).toContainText(
    "npm i @trpc/tanstack-react-query"
  )
})

test("an unknown package is not found", async ({ page, request }) => {
  const response = await request.get("/p/npm/gerch-no-such-package-q7x2")
  expect(response.status()).toBe(NOT_FOUND)
  await page.goto("/p/npm/gerch-no-such-package-q7x2")
  await expect(page.getByRole("main")).toContainText(
    "npm has no package named gerch-no-such-package-q7x2"
  )
})

test("a registry that is not built yet says so", async ({ page }) => {
  await page.goto("/p/crate/serde")
  await expect(page.getByRole("main")).toContainText(
    "crates.io packages are coming soon"
  )
})

test("package screenshot", async ({ page }, testInfo) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await focusFirstZodResult(page)
  await page.keyboard.press("Enter")
  const main = page.getByRole("main")
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("zod")
  await expect(main.locator("time")).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("package.png") })
})
