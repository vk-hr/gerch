import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

import { parseState } from "@/client/state.ts"

import {
  firstResult,
  interactive,
  pressTimes,
  searchBox,
  seedClientState,
  typeSearch,
} from "./support.ts"

const NOW = Date.now()
// The pin, one matching search, and the first three live results.
const SUGGESTIONS = 5

const zodSummary = {
  description: null,
  downloads: null,
  homepage: null,
  install: "npm i zod",
  license: "MIT",
  name: "zod",
  registry: "npm",
  releasedAt: null,
  repository: null,
  version: "4.0.0",
}

const suggestions = (page: Page) =>
  page.getByRole("listbox", { name: "Suggestions" })

const npmChip = (page: Page) =>
  page.getByRole("button", { name: "Remove the npm prefix" })

const options = (page: Page) => suggestions(page).getByRole("option")

// A pin for zod and two past searches, one of which matches "zod".
async function seedPinAndHistory(page: Page) {
  await seedClientState(page, {
    history: [
      { count: 3, lastUsed: NOW, query: "zod-mini", registry: null },
      { count: 9, lastUsed: NOW, query: "react", registry: null },
    ],
    workspaces: [
      {
        id: "w1",
        name: "portfolio deps",
        pins: [{ name: "zod", registry: "npm", summary: zodSummary }],
      },
    ],
  })
}

// Types "zod" and waits for its results and the suggestions built from them.
async function searchZodWithSuggestions(page: Page) {
  await seedPinAndHistory(page)
  await interactive(page, "/")
  await typeSearch(page, "zod")
  await expect(firstResult(page, "npm")).toBeVisible()
  await expect(options(page)).toHaveCount(SUGGESTIONS)
}

async function searchAndRecord(page: Page, text: string) {
  await interactive(page, "/")
  await typeSearch(page, text)
  await expect(firstResult(page, "npm")).toBeVisible()
  await expect
    .poll(async () => {
      const saved = await page.evaluate(() => localStorage.getItem("gerch:v1"))
      return parseState(saved).history.map((entry) => entry.query)
    })
    .toContain(text)
}

// The first Escape closes the suggestions, the second clears the query.
async function closeAndClear(page: Page, text: string) {
  await page.keyboard.press("Escape")
  await expect(searchBox(page)).toHaveAttribute("aria-expanded", "false")
  await expect(searchBox(page)).toHaveValue(text)
  await page.keyboard.press("Escape")
  await expect(searchBox(page)).toHaveValue("")
}

async function expectActive(page: Page, index: number) {
  const option = options(page).nth(index)
  const id = (await option.getAttribute("id")) ?? "missing"
  await expect(searchBox(page)).toHaveAttribute("aria-activedescendant", id)
  await expect(option).toHaveAttribute("aria-selected", "true")
  await expect(searchBox(page)).toBeFocused()
}

test("a committed search comes back as a suggestion", async ({ page }) => {
  await searchAndRecord(page, "zod")
  await closeAndClear(page, "zod")
  await page.keyboard.type("zo")
  await expect(options(page).first()).toHaveText(/zod/u)
  await expect(options(page).first()).toHaveAttribute("data-kind", "history")
  await page.keyboard.press("ArrowDown")
  await expectActive(page, 0)
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\?q=zod$/u)
  await expect(suggestions(page)).toBeHidden()
})

test("pins come first, then history, then live results", async ({ page }) => {
  await searchZodWithSuggestions(page)
  await expect(options(page)).toHaveText([
    /^zod/u,
    /^zod-mini/u,
    /^zod-to-json-schema/u,
    /^zod-validation-error/u,
    /^@hono\/zod-validator/u,
  ])
  const kinds = await options(page).evaluateAll((items) =>
    items.map((item) =>
      item instanceof HTMLElement ? item.dataset.kind : null
    )
  )
  expect(kinds).toStrictEqual(["pin", "history", "result", "result", "result"])
})

test("arrow keys go through the suggestions, then on to the results", async ({
  page,
}) => {
  await searchZodWithSuggestions(page)
  await pressTimes(page, "ArrowDown", SUGGESTIONS)
  await expectActive(page, SUGGESTIONS - 1)
  await page.keyboard.press("ArrowDown")
  await expect(firstResult(page, "npm")).toBeFocused()
  await page.keyboard.press("ArrowUp")
  await expect(searchBox(page)).toBeFocused()
  await expect(searchBox(page)).toHaveAttribute("aria-expanded", "false")
})

test("a prefix shows as a chip that Backspace removes", async ({ page }) => {
  await interactive(page, "/")
  await typeSearch(page, "npm:")
  await expect(searchBox(page)).toHaveValue("")
  await page.keyboard.type("zod")
  await expect(page).toHaveURL(/\?q=npm%3Azod$/u)
  await pressTimes(page, "Backspace", "zod".length)
  await expect(npmChip(page)).toBeVisible()
  await page.keyboard.press("Backspace")
  await expect(npmChip(page)).toBeHidden()
  await expect(page).toHaveURL(/\/$/u)
})

test("a direct link with a prefix renders the chip", async ({ page }) => {
  await page.goto("/?q=npm:zod")
  await expect(npmChip(page)).toBeVisible()
  await expect(searchBox(page)).toHaveValue("zod")
})

test("suggestions screenshot", async ({ page }, testInfo) => {
  await page.setViewportSize({ height: 720, width: 1280 })
  await searchZodWithSuggestions(page)
  await page.keyboard.press("ArrowDown")
  await expectActive(page, 0)
  await page.screenshot({ path: testInfo.outputPath("suggestions.png") })
})

test("prefix chip screenshot", async ({ page }, testInfo) => {
  await page.setViewportSize({ height: 720, width: 1280 })
  await interactive(page, "/")
  await typeSearch(page, "npm:react query")
  await expect(firstResult(page, "npm")).toBeVisible()
  await page.keyboard.press("Escape")
  await page.screenshot({ path: testInfo.outputPath("prefix-chip.png") })
})

test("clicking the search icon focuses the input with its prefix intact", async ({
  page,
}) => {
  await interactive(page, "/?q=npm:zod")
  await page.getByRole("main").locator("label svg.lucide-search").click()
  await expect(searchBox(page)).toBeFocused()
  await expect(npmChip(page)).toBeVisible()
})

test("the active suggestion follows its package when pins change", async ({
  page,
}) => {
  await searchZodWithSuggestions(page)
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowDown")
  await expectActive(page, 1)
  await page.evaluate(() => {
    const key = "gerch:v1"
    const state: unknown = JSON.parse(localStorage.getItem(key) ?? "{}")
    if (state === null || typeof state !== "object") {
      throw new Error("Expected saved client state")
    }
    localStorage.setItem(key, JSON.stringify({ ...state, workspaces: [] }))
    dispatchEvent(new StorageEvent("storage", { key }))
  })
  await expect(options(page).first()).toHaveText(/zod-mini/u)
  await expectActive(page, 0)
})
