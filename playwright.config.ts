import { defineConfig, devices } from "@playwright/test"

// GERCH_E2E_PORT lets several worktrees run the flows at once.
const PORT = Number(process.env.GERCH_E2E_PORT ?? "4173")

// End-to-end flows against the production build. The server replays
// recorded registry responses (GERCH_REPLAY_DIR), so no flow touches npm.
// No retries: a flow that needs one has a bug (docs/directives/ci.md).
export default defineConfig({
  forbidOnly: true,
  fullyParallel: true,
  reporter: [["list"]],
  retries: 0,
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://localhost:${PORT}`,
    // GitHub's runners ship Google Chrome; locally the Nix dev shell provides
    // Playwright's Chromium (PLAYWRIGHT_BROWSERS_PATH).
    channel: process.env.CI === undefined ? undefined : "chrome",
  },
  workers: process.env.CI === undefined ? undefined : "100%",
  webServer: {
    command: "bun run build && bun .output/server/index.mjs",
    env: { GERCH_REPLAY_DIR: "test/fixtures", PORT: String(PORT) },
    url: `http://localhost:${PORT}`,
  },
})
