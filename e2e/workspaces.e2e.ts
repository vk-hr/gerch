import { expect, test } from "@playwright/test"
import type { Locator, Page } from "@playwright/test"

async function interactive(page: Page, url: string) {
  await page.goto(url)
  await expect(page.locator("body[data-interactive]")).toBeAttached()
}

const firstResult = (page: Page) =>
  page.getByRole("region", { name: "npm" }).getByRole("article").first()

const picker = (page: Page) =>
  page.getByRole("dialog", { name: "Pin zod to a workspace" })

const workspacesDialog = (page: Page) => page.getByRole("dialog")

// Streamed results reach the page hidden; keys wait until a card shows
// (docs/decisions.md D23).
async function showZodResults(page: Page) {
  await interactive(page, "/?q=zod")
  await expect(firstResult(page)).toBeVisible()
}

async function focusFirstResult(page: Page) {
  await showZodResults(page)
  await page.getByRole("searchbox").focus()
  await page.keyboard.press("ArrowDown")
  await expect(firstResult(page)).toBeFocused()
}

async function openPicker(page: Page) {
  await page.keyboard.press("Alt+P")
  await expect(
    picker(page).getByRole("combobox", { name: "Workspace" })
  ).toBeFocused()
}

async function pinFocusedTo(page: Page, name: string, option: RegExp) {
  await openPicker(page)
  await page.keyboard.type(name)
  await expect(picker(page).getByRole("option")).toHaveText([option])
  await page.keyboard.press("Enter")
  await expect(picker(page)).toBeHidden()
}

async function openWorkspace(page: Page, name: string) {
  await page.keyboard.press("Alt+W")
  const filter = workspacesDialog(page).getByRole("combobox", {
    name: "Workspace",
  })
  await expect(filter).toBeFocused()
  await expect(
    workspacesDialog(page).getByRole("option", { name })
  ).toBeVisible()
  await page.keyboard.type(name)
  await page.keyboard.press("Enter")
  await expect(
    workspacesDialog(page).getByRole("heading", { name, level: 2 })
  ).toBeVisible()
}

async function pressOn(page: Page, name: string) {
  const button = workspacesDialog(page).getByRole("button", { name })
  await expect(button).toBeVisible()
  await button.focus()
  await page.keyboard.press("Enter")
}

test("Alt+P pins the focused result to a new workspace, once", async ({
  page,
}) => {
  await focusFirstResult(page)
  await pinFocusedTo(page, "portfolio deps", /Create "portfolio deps"/u)
  await expect(firstResult(page)).toBeFocused()
  await pinFocusedTo(page, "portfolio deps", /portfolio deps.*pinned/u)
  await expect(firstResult(page)).toBeFocused()

  await page.keyboard.press("Alt+W")
  await expect(
    workspacesDialog(page).getByRole("option", { name: /portfolio deps/u })
  ).toContainText("1 pin")
})

test("Escape closes the picker and returns focus to the card", async ({
  page,
}) => {
  await focusFirstResult(page)
  await openPicker(page)
  await page.keyboard.type("portfolio")
  await page.keyboard.press("Escape")
  await expect(picker(page)).toBeHidden()
  await expect(firstResult(page)).toBeFocused()
})

// Focus stays in the dialog: on Back once the last pin goes, then on the
// list's box once the workspace goes.
async function removePinThenWorkspace(page: Page) {
  const dialog = workspacesDialog(page)
  await pressOn(page, "Remove zod")
  await expect(dialog.getByRole("article")).toHaveCount(0)
  await expect(dialog).toContainText("No pins yet")
  await expect(
    dialog.getByRole("button", { name: "Back to workspaces" })
  ).toBeFocused()
  await pressOn(page, "Delete workspace")
  await expect(dialog).toContainText("No workspaces yet")
  await expect(
    dialog.getByRole("combobox", { name: "Workspace" })
  ).toBeFocused()
}

test("workspaces survive a reload and their pins and workspaces can be removed", async ({
  page,
}) => {
  await focusFirstResult(page)
  await pinFocusedTo(page, "portfolio deps", /Create "portfolio deps"/u)

  await interactive(page, "/")
  await openWorkspace(page, "portfolio deps")
  const cards = workspacesDialog(page).getByRole("article")
  await expect(cards.getByRole("heading")).toHaveText(["zod"])
  await removePinThenWorkspace(page)

  await interactive(page, "/")
  await page.keyboard.press("Alt+W")
  await expect(workspacesDialog(page)).toContainText("No workspaces yet")
})

const SNAPSHOT_VERSION = "0.0.1"

async function seedOldPin(page: Page) {
  await page.goto("/")
  await page.evaluate((version) => {
    const pin = {
      name: "zod",
      registry: "npm",
      summary: {
        description: null,
        downloads: null,
        homepage: null,
        install: "npm i zod",
        license: null,
        name: "zod",
        registry: "npm",
        releasedAt: "2019-01-01T00:00:00.000Z",
        repository: null,
        version,
      },
    }
    localStorage.setItem(
      "gerch:v1",
      JSON.stringify({
        activeTab: null,
        closedTabs: [],
        history: [],
        tabs: [],
        version: 1,
        workspaces: [{ id: "w1", name: "deps", pins: [pin] }],
      })
    )
  }, SNAPSHOT_VERSION)
}

// The version sits right after the card's name.
const versionOf = (card: Locator) => card.locator("h3 + span")

test("a pin shows the cached version, else its snapshot", async ({ page }) => {
  await seedOldPin(page)
  await interactive(page, "/")
  await openWorkspace(page, "deps")
  const pinned = workspacesDialog(page).getByRole("article")
  await expect(versionOf(pinned)).toHaveText(SNAPSHOT_VERSION)

  await showZodResults(page)
  const current = await versionOf(firstResult(page)).textContent()
  expect(current).not.toBe(SNAPSHOT_VERSION)
  await openWorkspace(page, "deps")
  await expect(versionOf(pinned)).toHaveText(current ?? "")
})

test("picker and workspace view screenshots", async ({ page }, testInfo) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await focusFirstResult(page)
  await pinFocusedTo(page, "portfolio deps", /Create "portfolio deps"/u)
  await openPicker(page)
  await page.keyboard.type("p")
  await expect(picker(page).getByRole("option")).toHaveText([
    /portfolio deps/u,
    /Create "p"/u,
  ])
  await page.screenshot({ path: testInfo.outputPath("pin-picker.png") })
  await page.keyboard.press("Escape")
  await openWorkspace(page, "portfolio deps")
  await page.screenshot({ path: testInfo.outputPath("workspace-view.png") })
})
