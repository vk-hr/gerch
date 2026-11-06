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
    if (
      exportName === "getSidebarOpenState_createServerFn_handler" &&
      !(exportName in mocks)
    ) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "x-tss-serialized": "true" },
        body: JSON.stringify(toCrossJSON({ result: true })),
      })
    }
    if (
      exportName === "getTheme_createServerFn_handler" &&
      !(exportName in mocks)
    ) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "x-tss-serialized": "true" },
        body: JSON.stringify(toCrossJSON({ result: "system" })),
      })
    }
    if (
      exportName === "listPins_createServerFn_handler" &&
      !(exportName in mocks)
    ) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "x-tss-serialized": "true" },
        body: JSON.stringify(toCrossJSON({ result: [] })),
      })
    }
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
    searchPackages_createServerFn_handler: { records: [react, vue] },
  })
  await openSearch(page)

  const input = page.getByRole("textbox", { name: "Search packages" })
  await page.keyboard.press("ControlOrMeta+k")
  await expect(input).toBeFocused()

  await page.keyboard.type("react")
  await expect(page).toHaveURL("/react")
  await expect(
    page.locator("a", { hasText: "React is a JavaScript library" })
  ).toBeVisible()
  await expect(page.locator("a", { hasText: "vue" }).first()).toBeVisible()

  await page.reload()
  await expect(input).toHaveValue("react")
  await expect(
    page.locator("a", { hasText: "React is a JavaScript library" })
  ).toBeVisible()
})

test("only fetches more result pages near the end of the list", async ({
  page,
}) => {
  const records = Array.from({ length: 25 }, (_, index) => ({
    ...react,
    name: `react-${index}`,
  }))
  let searchRequests = 0

  await mockServerFns(page, {
    searchPackages_createServerFn_handler: { records },
  })
  await page.route("**/_serverFn/**", (route) => {
    if (
      fnExport(route.request().url()) ===
      "searchPackages_createServerFn_handler"
    ) {
      searchRequests += 1
    }
    return route.fallback()
  })
  await openSearch(page)

  await page.getByRole("textbox", { name: "Search packages" }).fill("react")
  await expect(page.locator("a", { hasText: "react-0" }).first()).toBeVisible()
  await page.waitForTimeout(500)

  expect(searchRequests).toBe(1)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight
    )
  ).toBe(false)

  const results = page.locator("main .overflow-y-auto")
  await results.evaluate((element) => {
    element.scrollTop = element.clientHeight * 2
  })
  await page.waitForTimeout(100)
  expect(searchRequests).toBe(1)

  await results.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect.poll(() => searchRequests).toBe(2)
})

test("arrows and Enter open the highlighted package", async ({ page }) => {
  await mockServerFns(page, {
    searchPackages_createServerFn_handler: { records: [react, vue] },
    getPackage_createServerFn_handler: { record: vue },
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
    searchPackages_createServerFn_handler: { records: [react, vue] },
    getPackage_createServerFn_handler: { record: react },
  })
  await openSearch(page)

  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type("react")
  await page.keyboard.press("Enter")

  await expect(page).toHaveURL(/\/npm\/react$/)
  await expect(page.getByRole("heading", { name: "react" })).toBeVisible()
  await expect(page.getByText("MIT", { exact: true })).toBeVisible()
})

test("switching registry tabs fetches that registry's results", async ({
  page,
}) => {
  await mockServerFns(page, {
    searchPackages_createServerFn_handler: { records: [serde] },
  })
  await openSearch(page)

  await page.getByRole("button", { name: "crates.io" }).click()
  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type("serde")

  await expect(page.locator("a", { hasText: "serde" })).toBeVisible()
})

test("an unavailable nix backend shows the degradation banner", async ({
  page,
}) => {
  await mockServerFns(page, {
    searchPackages_createServerFn_handler: { records: [], degraded: true },
  })
  await openSearch(page)

  await page.getByRole("button", { name: "nixpkgs" }).click()
  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type("ripgrep")

  await expect(page.getByRole("status")).toContainText(
    "nixpkgs search is unavailable"
  )
})

test("a failed package load shows the error boundary with retry", async ({
  page,
}) => {
  await mockServerFns(page, {
    searchPackages_createServerFn_handler: { records: [react] },
  })
  await openSearch(page)

  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type("react")
  await page
    .locator("a", { hasText: "React is a JavaScript library" })
    .first()
    .click()

  await expect(page.getByRole("alert")).toContainText(
    "Could not load this package"
  )
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible()
})

test("a missing package shows the not-found page", async ({ page }) => {
  await mockServerFns(page, {
    getPackage_createServerFn_handler: { notFound: true },
  })

  await page.goto("/npm/definitely-not-real")
  await expect(page.getByText("Package not found")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Back to search" })
  ).toBeVisible()
})

test("no results shows an empty state", async ({ page }) => {
  await mockServerFns(page, {
    searchPackages_createServerFn_handler: { records: [] },
  })
  await openSearch(page)

  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type("definitely-not-a-package")

  await expect(page.getByText(/No packages found for/)).toBeVisible()
})

test("search block starts centered and slides to the top on query", async ({
  page,
}) => {
  await mockServerFns(page, {
    searchPackages_createServerFn_handler: { records: [] },
  })
  await openSearch(page)

  const layout = page.getByTestId("search-layout")
  const before = (await layout.boundingBox())!.y
  await page.waitForTimeout(400)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight
    )
  ).toBe(false)
  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type("react")
  await page.waitForTimeout(400)
  const after = (await layout.boundingBox())!.y
  expect(after).toBeLessThan(before)
})
