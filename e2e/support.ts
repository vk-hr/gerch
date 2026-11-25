import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"

// Keys go to the page only once its hotkeys are registered (D23).
async function interactive(page: Page, url: string) {
  await page.goto(url)
  await expect(page.locator("body[data-interactive]")).toBeAttached()
}

const firstResult = (page: Page, registry: string) =>
  page.getByRole("region", { name: registry }).getByRole("article").first()

const tabStrip = (page: Page) => page.getByRole("navigation", { name: "Tabs" })
const tabLinks = (page: Page) => tabStrip(page).getByRole("link")
const tabLink = (page: Page, name: string) =>
  tabStrip(page).getByRole("link", { exact: true, name })
const activeTab = (page: Page) =>
  tabStrip(page).locator("a[aria-current='page']")

// Opens /?q=zod and focuses its first npm result, ready for Enter.
async function focusFirstZodResult(page: Page) {
  await interactive(page, "/?q=zod")
  // Streamed results are revealed up to 300 ms after they arrive (D23).
  await expect(firstResult(page, "npm")).toBeVisible()
  await page.getByRole("searchbox").focus()
  await page.keyboard.press("ArrowDown")
  await expect(firstResult(page, "npm")).toBeFocused()
}

export {
  activeTab,
  firstResult,
  focusFirstZodResult,
  interactive,
  tabLink,
  tabLinks,
  tabStrip,
}
