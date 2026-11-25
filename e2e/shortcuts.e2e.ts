import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

import { HOTKEYS } from "@/hotkeys.ts"

import { firstResult, interactive, pressTimes, searchBox } from "./support.ts"

const labels = [
  ...new Set(Object.values(HOTKEYS).map((hotkey) => hotkey.label)),
]

const SECOND_RESULT = 1

const shortcutList = (page: Page) =>
  page.getByRole("dialog", { name: "Keyboard shortcuts" })

// Records whether the page cancelled Ctrl+P, the browser's print shortcut,
// once the key press has reached every listener.
async function watchPrint(page: Page) {
  await page.evaluate(() => {
    globalThis.addEventListener(
      "keydown",
      (event) => {
        if (
          event instanceof KeyboardEvent &&
          event.ctrlKey &&
          event.code === "KeyP"
        ) {
          setTimeout(() => {
            document.body.dataset.printPrevented = String(
              event.defaultPrevented
            )
          }, 0)
        }
      },
      { capture: true }
    )
  })
}

test("? lists every shortcut and Escape closes the list", async ({ page }) => {
  await interactive(page, "/")
  await page.keyboard.press("Shift+?")
  await expect(shortcutList(page)).toBeVisible()
  await expect(shortcutList(page).getByRole("rowheader")).toHaveText(labels)
  await expect(shortcutList(page)).toContainText("Ctrl")
  await page.keyboard.press("Escape")
  await expect(shortcutList(page)).toBeHidden()
})

test("? types into the search box instead of opening the list", async ({
  page,
}) => {
  await interactive(page, "/")
  await page.keyboard.press("/")
  await expect(searchBox(page)).toBeFocused()
  await page.keyboard.press("Shift+?")
  await expect(searchBox(page)).toHaveValue("?")
  await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("Ctrl+N and Ctrl+P move through results and Ctrl+P does not print", async ({
  page,
}) => {
  await interactive(page, "/?q=zod")
  await watchPrint(page)
  await expect(firstResult(page, "npm")).toBeVisible()
  const results = page.getByRole("region", { name: "npm" }).getByRole("article")
  await searchBox(page).focus()
  await pressTimes(page, "Control+KeyN", SECOND_RESULT + 1)
  await expect(results.nth(SECOND_RESULT)).toBeFocused()
  await page.keyboard.press("Control+KeyP")
  await expect(results.nth(0)).toBeFocused()
  await expect(page.locator("body")).toHaveAttribute(
    "data-print-prevented",
    "true"
  )
})

test("shortcut list screenshot", async ({ page }, testInfo) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await interactive(page, "/")
  await page.keyboard.press("Shift+?")
  await expect(shortcutList(page)).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath("shortcuts.png") })
})
