import { expect, test } from "@playwright/test"

test("the index route renders", async ({ page }) => {
  const pageErrors: Error[] = []
  page.on("pageerror", (error) => pageErrors.push(error))

  await page.goto("/")

  await expect(
    page.getByRole("heading", { name: "Project ready!" })
  ).toBeVisible()
  expect(pageErrors).toEqual([])
})
