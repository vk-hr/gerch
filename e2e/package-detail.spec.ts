import { expect, test, type Page } from "@playwright/test"
import { toCrossJSON } from "seroval"

function fnExport(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? ""
  const decoded = JSON.parse(Buffer.from(id, "base64").toString("utf8"))
  return decoded.export as string
}

async function mockDetail(page: Page, detail: unknown, theme = "system") {
  await page.route("**/_serverFn/**", (route) => {
    const exportName = fnExport(route.request().url())
    const record = (detail as { record: { name: string } }).record
    const result =
      exportName === "getPackage_createServerFn_handler"
        ? detail
        : exportName === "searchPackages_createServerFn_handler"
          ? { records: [record] }
          : exportName === "getSidebarOpenState_createServerFn_handler"
            ? true
            : exportName === "getTheme_createServerFn_handler"
              ? theme
              : exportName === "listPins_createServerFn_handler"
                ? []
                : undefined
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "x-tss-serialized": "true" },
      body: JSON.stringify(toCrossJSON({ result })),
    })
  })
}

async function openFromSearch(page: Page, query: string) {
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await page.getByRole("textbox", { name: "Search packages" }).click()
  await page.keyboard.type(query)
  const result = page.locator("a", { hasText: query }).first()
  await result.waitFor()
  await result.click()
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
    repository: "https://github.com/facebook/react",
  },
  downloads: { monthly: 400_000_000 },
}

test("package detail shows installation, metadata, and readme", async ({
  page,
}) => {
  await mockDetail(page, {
    record: react,
    readmeHtml: "<h2>Getting started</h2><p>Use React.</p>",
  })

  await openFromSearch(page, "react")
  await expect(
    page.locator("header").getByRole("heading", { name: "react" })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Installation" })
  ).toBeVisible()
  await expect(page.getByText("npm install react")).toBeVisible()
  await expect(page.getByText("License")).toBeVisible()
  await expect(page.getByText("MIT", { exact: true })).toBeVisible()
  await expect(page.getByText("400.0M / month")).toBeVisible()
  await expect(page.getByRole("button", { name: "Pin package" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Open project" })).toBeVisible()
  await expect(page.locator("dt svg").first()).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Getting started" })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Copy install command" })
  ).toBeVisible()
})

test("nix deep link shows channel, install command, and all metadata", async ({
  page,
}) => {
  await mockDetail(page, {
    record: {
      registry: "nix",
      name: "firefox-bin",
      version: "140.0",
      description: "Firefox binary",
      license: "MPL-2.0",
      licenses: ["MPL-2.0", "GPL-3.0"],
      homepages: ["https://mozilla.org", "https://firefox.org"],
      links: { homepage: "https://mozilla.org" },
    },
  })

  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "nixpkgs" }).click()
  await page.getByRole("combobox", { name: "Nix channel" }).click()
  await page.getByRole("option", { name: "26.05" }).click()
  await openFromSearch(page, "firefox-bin")
  await expect(page.getByText("nixos-26.05", { exact: true })).toBeVisible()
  await expect(
    page.getByText("nix profile install nixpkgs#firefox-bin")
  ).toBeVisible()
  await expect(page.getByText("MPL-2.0, GPL-3.0")).toBeVisible()
  await expect(
    page.getByRole("link", { name: "https://mozilla.org" })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "https://firefox.org" })
  ).toBeVisible()
})

test("versions stay collapsed until requested and mark current", async ({
  page,
}) => {
  await mockDetail(page, {
    record: { ...react, registry: "crates", name: "serde" },
    versions: [
      { num: "1.0.219", created_at: "2026-01-01T00:00:00Z" },
      { num: "1.0.218", created_at: "2025-12-01T00:00:00Z" },
    ],
  })

  await page.goto("/")
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "crates.io" }).click()
  await openFromSearch(page, "serde")
  await expect(page.getByText("Versions (2)")).toBeVisible()
  await expect(page.getByText("1.0.219")).not.toBeVisible()
  await page.getByText("Versions (2)").click()
  await expect(page.getByText("1.0.219")).toBeVisible()
  await expect(page.getByText("1.0.218")).toBeVisible()
  await expect(page.getByText("current", { exact: true })).not.toBeVisible()
})

test("a package without a readme keeps useful content and shows an explicit state", async ({
  page,
}) => {
  await mockDetail(page, { record: react })

  await openFromSearch(page, "react")
  await expect(page.getByText("npm install react")).toBeVisible()
  await expect(
    page.getByText("Readme unavailable for this package.")
  ).toBeVisible()
})

test("package detail renders in dark theme", async ({ page }) => {
  await mockDetail(
    page,
    { record: react, readmeHtml: "<p>Use React.</p>" },
    "dark"
  )

  await page.emulateMedia({ colorScheme: "dark" })
  await openFromSearch(page, "react")
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(
    page.getByRole("heading", { name: "Readme", exact: true })
  ).toBeVisible()
})

test("back to search returns to the search page", async ({ page }) => {
  await mockDetail(page, { record: react })

  await openFromSearch(page, "react")
  await page.getByRole("button", { name: "Back to search" }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByRole("textbox", { name: "Search packages" })
  ).toBeVisible()
})

test("back arrow moves right when the sidebar collapses", async ({ page }) => {
  await mockDetail(page, { record: react })
  await openFromSearch(page, "react")

  const arrow = page.getByRole("button", { name: "Back to search" })
  const before = await arrow.evaluate(
    (element) => getComputedStyle(element.parentElement!).left
  )
  expect(Number.parseFloat(before)).toBeGreaterThan(15)
  expect(Number.parseFloat(before)).toBeLessThan(17)
  await page
    .locator('[data-slot="sidebar-header"]')
    .getByRole("button", { name: "Toggle Sidebar" })
    .click()
  await page.waitForTimeout(400)
  const after = await arrow.evaluate(
    (element) => getComputedStyle(element.parentElement!).left
  )
  expect(Number.parseFloat(after)).toBeGreaterThan(55)
  expect(Number.parseFloat(after)).toBeLessThan(57)

  await page
    .locator("main")
    .getByRole("button", { name: "Toggle Sidebar" })
    .click()
  await page.waitForTimeout(400)
  const finalLeft = await arrow.evaluate(
    (element) => getComputedStyle(element.parentElement!).left
  )
  expect(Number.parseFloat(finalLeft)).toBeGreaterThan(15)
  expect(Number.parseFloat(finalLeft)).toBeLessThan(17)
})
