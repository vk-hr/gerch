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

export {
  firstResult,
  interactive,
  pressTimes,
  searchBox,
  seedClientState,
  typeSearch,
}
