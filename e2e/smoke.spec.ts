import { expect, test } from "@playwright/test"

test("the search page renders", async ({ page }) => {
  const pageErrors: Error[] = []
  page.on("pageerror", (error) => pageErrors.push(error))

  await page.goto("/")

  await expect(
    page.getByRole("textbox", { name: "Search packages" })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "npm" })).toBeVisible()
  await expect(page.getByRole("button", { name: "crates.io" })).toBeVisible()
  await expect(page.getByRole("button", { name: "nixpkgs" })).toBeVisible()
  expect(pageErrors).toEqual([])
})
