import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

import { firstResult, interactive, searchBox, typeSearch } from "./support.ts"

// Everything the page keeps in IndexedDB, as text. History in localStorage
// is left out: it records failed searches too.
async function savedIndexedDb(page: Page): Promise<string> {
  const state = await page.context().storageState({ indexedDB: true })
  return JSON.stringify(state.origins, (key, value: unknown) =>
    key === "localStorage" ? undefined : value
  )
}

async function searchAndPersist(page: Page, text: string, install: string) {
  await typeSearch(page, text)
  await expect(firstResult(page, "npm")).toBeVisible()
  await expect.poll(async () => savedIndexedDb(page)).toContain(install)
}

// From here on no search request ever answers, so results can only come from
// the persisted cache. The clock moves past the search's 60 s stale time, so
// a request still goes out: that is the background revalidation.
const LATER_MS = 120_000

async function holdSearchRequests(page: Page): Promise<{ count: number }> {
  const requests = { count: 0 }
  await page.route("**/_serverFn/**", () => {
    requests.count += 1
  })
  await page.clock.setFixedTime(Date.now() + LATER_MS)
  return requests
}

test("a repeated search renders from the persisted cache after a reload", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text())
    }
  })
  await interactive(page, "/")
  await searchAndPersist(page, "zod", "npm i zod")
  const requests = await holdSearchRequests(page)
  await interactive(page, "/")
  await typeSearch(page, "zod")
  await expect(firstResult(page, "npm").getByRole("heading")).toHaveText("zod")
  await expect.poll(() => requests.count).toBeGreaterThan(0)
  expect(errors).toStrictEqual([])
})

test("failed searches are not persisted", async ({ page }) => {
  await interactive(page, "/")
  await typeSearch(page, "npm:no-recorded-fixture")
  await expect(page.getByRole("region", { name: "npm" })).toContainText(
    "npm is unavailable"
  )
  await searchBox(page).fill("zod")
  await expect(firstResult(page, "npm")).toBeVisible()
  await expect.poll(async () => savedIndexedDb(page)).toContain("npm i zod")
  expect(await savedIndexedDb(page)).not.toContain("no-recorded-fixture")
})
