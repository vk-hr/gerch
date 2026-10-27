import { expect, test, type Page } from "@playwright/test"
import { toCrossJSON } from "seroval"

function fnExport(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? ""
  const decoded = JSON.parse(Buffer.from(id, "base64").toString("utf8"))
  return decoded.export as string
}

async function mockServerFns(page: Page, mocks: Record<string, unknown>) {
  await page.route("**/_serverFn/**", (route) => {
    const exportName = fnExport(route.request().url())
    if (!(exportName in mocks)) {
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: `unmocked server fn: ${exportName}` }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "x-tss-serialized": "true" },
      body: JSON.stringify(toCrossJSON({ result: mocks[exportName] })),
    })
  })
}

const react = {
  registry: "npm",
  name: "react",
  version: "19.3.1",
  description: "React is a JavaScript library",
  license: "MIT",
  links: {
    registry: "https://www.npmjs.com/package/react",
    homepage: "https://react.dev/",
  },
  downloads: { monthly: 100 },
}

const vue = {
  registry: "npm",
  name: "vue",
  version: "3.5.0",
  description: "The progressive JavaScript framework",
  license: "MIT",
  links: {},
}

const serde = {
  registry: "crates",
  name: "serde",
  version: "1.0.219",
  description: "A generic serialization/deserialization framework",
  license: "MIT OR Apache-2.0",
  links: {},
}

async function openSearch(page: Page) {
  await page.goto("/")
  await page.waitForLoadState("networkidle")
}

test("Mod+K focuses the search box and results render", async ({ page }) => {
  await mockServerFns(page, {
    searchNpm_createServerFn_handler: [react, vue],
  })
  await openSearch(page)

  const input = page.getByRole("textbox", { name: "Search packages" })
  await page.keyboard.press("ControlOrMeta+k")
  await expect(input).toBeFocused()

  await page.keyboard.type("react")
  await expect(
    page.locator("a", { hasText: "React is a JavaScript library" })
  ).toBeVisible()
  await expect(page.locator("a", { hasText: "vue" }).first()).toBeVisible()
})

test("arrows and Enter open the highlighted package", async ({ page }) => {
  await mockServerFns(page, {
    searchNpm_createServerFn_handler: [react, vue],
    npmPackage_createServerFn_handler: { record: vue },
  })
  await openSearch(page)

  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type("rea")
  await expect(
    page.locator("a", { hasText: "React is a JavaScript library" })
  ).toBeVisible()

  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/npm\/vue$/)
  await expect(page.getByRole("heading", { name: "vue" })).toBeVisible()
})

test("Enter on an exact-name match navigates straight to the package", async ({
  page,
}) => {
  await mockServerFns(page, {
    searchNpm_createServerFn_handler: [react, vue],
    npmPackage_createServerFn_handler: { record: react },
  })
  await openSearch(page)

  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type("react")
  await page.keyboard.press("Enter")

  await expect(page).toHaveURL(/\/npm\/react$/)
  await expect(page.getByRole("heading", { name: "react" })).toBeVisible()
  await expect(page.getByText("License: MIT")).toBeVisible()
})

test("switching registry tabs fetches that registry's results", async ({
  page,
}) => {
  await mockServerFns(page, {
    searchCrates_createServerFn_handler: [serde],
  })
  await openSearch(page)

  await page.getByRole("tab", { name: "crates.io" }).click()
  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type("serde")

  await expect(page.locator("a", { hasText: "serde" })).toBeVisible()
})

test("an unavailable nix backend shows the degradation banner", async ({
  page,
}) => {
  await mockServerFns(page, {
    searchNix_createServerFn_handler: { ok: false, reason: "unavailable" },
  })
  await openSearch(page)

  await page.getByRole("tab", { name: "nixpkgs" }).click()
  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type("ripgrep")

  await expect(page.getByRole("status")).toContainText(
    "nixpkgs search is unavailable"
  )
})

test("no results shows an empty state", async ({ page }) => {
  await mockServerFns(page, {
    searchNpm_createServerFn_handler: [],
  })
  await openSearch(page)

  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type("definitely-not-a-package")

  await expect(page.getByText(/No packages found for/)).toBeVisible()
})
