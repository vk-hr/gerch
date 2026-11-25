import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"

// Opens a page and waits until its hotkeys are registered (D23).
async function interactive(page: Page, url: string) {
  await page.goto(url)
  await expect(page.locator("body[data-interactive]")).toBeAttached()
}

const searchBox = (page: Page) =>
  page.getByRole("combobox", { name: "Search packages" })

const firstResult = (page: Page, registry: string) =>
  page.getByRole("region", { name: registry }).getByRole("article").first()

// Focuses the search box with `/` and types, as a user would.
async function typeSearch(page: Page, text: string) {
  await page.keyboard.press("/")
  await expect(searchBox(page)).toBeFocused()
  await page.keyboard.type(text)
}

// Presses a key several times, one press after another.
async function pressTimes(page: Page, key: string, times: number) {
  await Array.from({ length: times }).reduce<Promise<void>>(
    async (previous) => {
      await previous
      await page.keyboard.press(key)
    },
    Promise.resolve()
  )
}

// Saved client state (src/client/state.ts), written before the page loads.
async function seedClientState(page: Page, state: Record<string, unknown>) {
  await page.addInitScript(
    (saved) => {
      localStorage.setItem("gerch:v1", JSON.stringify(saved))
    },
    {
      activeTab: null,
      closedTabs: [],
      history: [],
      tabs: [],
      version: 1,
      workspaces: [],
      ...state,
    }
  )
}

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
  await searchBox(page).focus()
  await page.keyboard.press("ArrowDown")
  await expect(firstResult(page, "npm")).toBeFocused()
}

export {
  activeTab,
  focusFirstZodResult,
  tabLink,
  tabLinks,
  tabStrip,
  firstResult,
  interactive,
  pressTimes,
  searchBox,
  seedClientState,
  typeSearch,
}
