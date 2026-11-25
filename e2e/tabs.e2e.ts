import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

import {
  activeTab,
  firstResult,
  focusFirstZodResult,
  interactive,
  tabLink,
  tabLinks,
  tabStrip,
} from "./support.ts"

const ZOD_URL = /\/\?q=zod$/u
const PACKAGE_URL = /\/p\/npm\/zod$/u
const REACT_QUERY_URL = /\/\?q=react(?:\+|%20)query$/u
// Longer than the search box's URL debounce (150 ms).
const PAST_DEBOUNCE_MS = 1000

// A search tab for zod with a package tab for zod next to it, search active.
async function twoTabs(page: Page) {
  await focusFirstZodResult(page)
  await page.keyboard.press("Shift+Enter")
  await expect(tabLinks(page)).toHaveText(["Search zod", "npm package zod"])
}

// Two saved search tabs, zod and react query; the page then shows zod and
// the user clicks over to react query, so the search page stays mounted.
async function switchSearchTabs(page: Page) {
  const tabs = ["zod", "react query"].map((query, index) => ({
    id: `seed-${index}`,
    kind: "search",
    query,
  }))
  const saved = { activeTab: "seed-0", closedTabs: [], history: [], tabs }
  await page.clock.install()
  await page.addInitScript(
    (value) => {
      localStorage.setItem("gerch:v1", value)
    },
    JSON.stringify({ ...saved, version: 1, workspaces: [] })
  )
  await interactive(page, "/?q=zod")
  await tabLink(page, "Search react query").click()
  await expect(page).toHaveURL(REACT_QUERY_URL)
  await expect(page.getByRole("searchbox")).toHaveValue("react query")
}

test("Shift+Enter opens a package tab next to the search tab, which keeps its query and selection", async ({
  page,
}) => {
  await twoTabs(page)
  await expect(page).toHaveURL(ZOD_URL)
  await expect(activeTab(page)).toHaveText("Search zod")
  await expect(firstResult(page, "npm")).toBeFocused()
  await expect(page.getByRole("searchbox")).toHaveValue("zod")
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Shift+Enter")
  await expect(tabLinks(page)).toHaveText([
    "Search zod",
    "npm package zod-to-json-schema",
    "npm package zod",
  ])
})

test("Alt+. and Alt+, switch tabs and wrap around", async ({ page }) => {
  await twoTabs(page)
  await page.keyboard.press("Alt+Period")
  await expect(page).toHaveURL(PACKAGE_URL)
  await expect(activeTab(page)).toHaveText("npm package zod")
  await page.keyboard.press("Alt+Comma")
  await expect(page).toHaveURL(ZOD_URL)
  await page.keyboard.press("Alt+Comma")
  await expect(page).toHaveURL(PACKAGE_URL)
})

test("a click activates a tab", async ({ page }) => {
  await twoTabs(page)
  await tabLink(page, "npm package zod").click()
  await expect(page).toHaveURL(PACKAGE_URL)
  await tabLink(page, "Search zod").click()
  await expect(page).toHaveURL(ZOD_URL)
  await expect(activeTab(page)).toHaveText("Search zod")
})

test("Alt+Shift+. and Alt+Shift+, move the current tab", async ({ page }) => {
  await twoTabs(page)
  await page.keyboard.press("Alt+Shift+Period")
  await expect(tabLinks(page)).toHaveText(["npm package zod", "Search zod"])
  await expect(activeTab(page)).toHaveText("Search zod")
  await page.keyboard.press("Alt+Shift+Comma")
  await expect(tabLinks(page)).toHaveText(["Search zod", "npm package zod"])
})

test("Alt+X closes the current tab and Alt+Shift+X reopens it", async ({
  page,
}) => {
  await twoTabs(page)
  await page.keyboard.press("Alt+Period")
  await expect(page).toHaveURL(PACKAGE_URL)
  await page.keyboard.press("Alt+X")
  await expect(tabLinks(page)).toHaveText(["Search zod"])
  await expect(page).toHaveURL(ZOD_URL)
  await page.keyboard.press("Alt+Shift+X")
  await expect(tabLinks(page)).toHaveText(["Search zod", "npm package zod"])
  await expect(page).toHaveURL(PACKAGE_URL)
})

test("the close button closes a tab", async ({ page }) => {
  await twoTabs(page)
  await tabStrip(page).getByRole("button", { name: "Close Search zod" }).click()
  await expect(tabLinks(page)).toHaveText(["npm package zod"])
  await expect(page).toHaveURL(PACKAGE_URL)
})

test("tabs, their order and the active tab come back after a reload", async ({
  page,
}) => {
  await twoTabs(page)
  await page.keyboard.press("Alt+Shift+Period")
  await page.keyboard.press("Alt+Comma")
  await expect(page).toHaveURL(PACKAGE_URL)
  await page.reload()
  await expect(page.locator("body[data-interactive]")).toBeAttached()
  await expect(tabLinks(page)).toHaveText(["npm package zod", "Search zod"])
  await expect(activeTab(page)).toHaveText("npm package zod")
  await expect(page).toHaveURL(PACKAGE_URL)
})

test("the tab strip's space is reserved before it renders", async ({
  browser,
  page,
}) => {
  const serverOnly = await browser.newPage({ javaScriptEnabled: false })
  await serverOnly.goto("/?q=zod")
  const before = await serverOnly.getByRole("main").boundingBox()
  await serverOnly.close()
  await interactive(page, "/?q=zod")
  await expect(tabLinks(page)).toHaveText(["Search zod"])
  const after = await page.getByRole("main").boundingBox()
  expect(after?.y).toBe(before?.y)
})

test("back and forward between search tabs resync the search box", async ({
  page,
}) => {
  await switchSearchTabs(page)
  await page.goBack()
  await expect(page.getByRole("searchbox")).toHaveValue("zod")
  // A debounced write of the old text would fire now and replace this entry.
  await page.clock.runFor(PAST_DEBOUNCE_MS)
  await expect(page).toHaveURL(ZOD_URL)
  await expect(activeTab(page)).toHaveText("Search zod")
  await page.goForward()
  await expect(page.getByRole("searchbox")).toHaveValue("react query")
  await expect(activeTab(page)).toHaveText("Search react query")
})

test("text still waiting on the debounce never replaces the entry back leads to", async ({
  page,
}) => {
  await switchSearchTabs(page)
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1)
  await page.getByRole("searchbox").press("End")
  await page.keyboard.type(" x")
  await page.goBack()
  await page.clock.runFor(PAST_DEBOUNCE_MS)
  await expect(page.getByRole("searchbox")).toHaveValue("zod")
  await expect(page).toHaveURL(ZOD_URL)
  await page.goForward()
  await expect(page).toHaveURL(REACT_QUERY_URL)
})

test("tabs screenshot", async ({ page }, testInfo) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await twoTabs(page)
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Shift+Enter")
  await page.screenshot({ path: testInfo.outputPath("tabs.png") })
})
