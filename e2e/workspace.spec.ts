import { expect, test, type Page } from "@playwright/test"
import { toCrossJSON } from "seroval"

function fnExport(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? ""
  const decoded = JSON.parse(Buffer.from(id, "base64").toString("utf8"))
  return decoded.export as string
}

const react = {
  registry: "npm",
  name: "react",
  version: "19.3.1",
  description: "React is a JavaScript library",
  license: "MIT",
  links: {},
}

async function mockWorkspace(page: Page, pins: unknown[]) {
  await page.route("**/_serverFn/**", (route) => {
    const exportName = fnExport(route.request().url())
    const respond = (result: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "x-tss-serialized": "true" },
        body: JSON.stringify(toCrossJSON({ result })),
      })

    switch (exportName) {
      case "searchNpm_createServerFn_handler":
        return respond([react])
      case "npmPackage_createServerFn_handler":
        return respond({ record: react })
      case "listPins_createServerFn_handler":
        return respond(pins)
      case "addPin_createServerFn_handler": {
        pins.push({ registry: "npm", name: "react" })
        return respond(pins)
      }
      case "removePin_createServerFn_handler": {
        pins.length = 0
        return respond(pins)
      }
      default:
        return route.fulfill({
          status: 500,
          body: JSON.stringify({ error: `unmocked: ${exportName}` }),
        })
    }
  })
}

test("pinning and open tabs persist across a reload", async ({ page }) => {
  const pins: unknown[] = []
  await mockWorkspace(page, pins)

  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type("react")
  await page
    .locator("a", { hasText: "React is a JavaScript library" })
    .first()
    .click()

  await page.getByRole("button", { name: "Pin", exact: true }).click()
  await expect(page.locator("aside")).toContainText("react")

  await page.reload()
  await page.waitForLoadState("networkidle")
  const aside = page.locator("aside")
  await expect(aside.getByText("Pinned", { exact: true })).toBeVisible()
  await expect(aside).toContainText("react")
  await expect(aside.getByText("Open tabs", { exact: true })).toBeVisible()
})

test("reopening a package reuses its tab", async ({ page }) => {
  const pins: unknown[] = []
  await mockWorkspace(page, pins)

  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type("react")
  await page
    .locator("a", { hasText: "React is a JavaScript library" })
    .first()
    .click()

  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type("react")
  await page
    .locator("a", { hasText: "React is a JavaScript library" })
    .first()
    .click()

  const tabLinks = page.locator("aside").getByRole("link", { name: "react" })
  await expect(tabLinks).toHaveCount(1)
})
