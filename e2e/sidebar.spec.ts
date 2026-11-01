import { expect, test } from "@playwright/test"

test("collapsed sidebar hides content but keeps a toggle available", async ({
  page,
}) => {
  await page.goto("/")
  await page.waitForLoadState("networkidle")

  await page
    .locator('[data-slot="sidebar-header"]')
    .getByRole("button", { name: "Toggle Sidebar" })
    .click()

  await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute(
    "data-state",
    "collapsed"
  )
  await page.waitForTimeout(300)
  const collapsedContainer = page.locator('[data-slot="sidebar-container"]')
  const box = await collapsedContainer.boundingBox()
  expect(box).not.toBeNull()
  if (box) expect(box.x + box.width).toBeLessThanOrEqual(0)
  await expect(
    page.locator("main").getByRole("button", { name: "Toggle Sidebar" })
  ).toBeVisible()

  await page
    .locator("main")
    .getByRole("button", { name: "Toggle Sidebar" })
    .click()
  await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute(
    "data-state",
    "expanded"
  )
  await expect(page.locator('[data-slot="sidebar-content"]')).toBeVisible()
})

test("sidebar state is restored from the cookie on initial render", async ({
  context,
  page,
}) => {
  await context.addCookies([
    { name: "sidebar_state", value: "false", url: "http://localhost:3100" },
  ])

  await page.goto("/")
  await expect(page.locator('[data-slot="sidebar"]')).toHaveAttribute(
    "data-state",
    "collapsed"
  )
  await expect(
    page.locator("main").getByRole("button", { name: "Toggle Sidebar" })
  ).toBeVisible()
})
