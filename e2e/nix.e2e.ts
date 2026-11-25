import { expect, test } from "@playwright/test"

import { firstResult } from "./support.ts"

const NOT_FOUND = 404

test("nix:ripgrep ranks the exact attribute first", async ({ page }) => {
  await page.goto("/?q=nix:ripgrep")
  const nix = page.getByRole("region", { name: "nixpkgs" })
  const ripgrep = firstResult(page, "nixpkgs")
  await expect(ripgrep.getByRole("heading")).toHaveText("ripgrep")
  await expect(ripgrep).toContainText("15.2.0")
  await expect(ripgrep).toContainText("Unlicense OR MIT")
  await expect(ripgrep).toContainText("nix-shell -p ripgrep")
  await expect(nix.getByRole("article").nth(1).getByRole("heading")).toHaveText(
    "ripgrep-all"
  )
  await expect(page.getByRole("region", { name: "npm" })).toHaveCount(0)
})

test("a nix package page renders on the server", async ({ page, request }) => {
  const response = await request.get("/p/nix/python313Packages.requests")
  expect(response.ok()).toBe(true)
  const html = await response.text()
  expect(html).toContain("nix-shell -p python313Packages.requests")
  expect(html).toContain("Apache-2.0")
  await page.goto("/p/nix/python313Packages.requests")
  const main = page.getByRole("main")
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "python313Packages.requests"
  )
  // The dump has no release dates or download counts.
  await expect(main.locator("time")).toHaveCount(0)
})

test("an unknown nix attribute is not found", async ({ request }) => {
  const response = await request.get("/p/nix/gerch-no-such-package-q7x2")
  expect(response.status()).toBe(NOT_FOUND)
})

test("the health route reports no nix index without a database", async ({
  request,
}) => {
  const response = await request.get("/api/health")
  expect(response.headers()["cache-control"]).toBe("no-store")
  await expect(response.json()).resolves.toStrictEqual({
    nix: null,
    ok: true,
    refreshFailures: [],
  })
})

test("nix screenshot", async ({ page }, testInfo) => {
  await page.setViewportSize({ height: 900, width: 1280 })
  await page.goto("/?q=nix:ripgrep")
  await expect(firstResult(page, "nixpkgs")).toBeVisible()
  await page.screenshot({
    fullPage: false,
    path: testInfo.outputPath("nix.png"),
  })
})
