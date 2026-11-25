// Fails when a cold entry ships more than the performance directive allows:
// 150 kB of JS, 50 kB of route-specific JS, or 20 kB of first-view CSS, all
// Brotli. It starts the production build on recorded fixtures and reads the
// assets each page's server HTML loads (scripts, module preloads,
// stylesheets), each counted once per page. Run after `bun run build`.
import { brotliCompressSync, constants } from "node:zlib"

const BUDGETS = { css: 20_000, js: 150_000, routeJs: 50_000 }

// One page per route template, plus a search with results.
const PAGES = ["/", "/?q=zod", "/p/npm/zod"]

interface PageSize {
  path: string
  js: number
  // JS only this page's route loads, beyond the shell every page shares.
  routeJs: number
  css: number
}

const ASSET = /(?:src|href)="(?<asset>\/assets\/[^"]+\.(?<kind>js|css))"/gu

function pageAssets(html: string): { js: string[]; css: string[] } {
  const found = { css: new Set<string>(), js: new Set<string>() }
  for (const match of html.matchAll(ASSET)) {
    const { asset = "", kind = "" } = match.groups ?? {}
    found[kind === "css" ? "css" : "js"].add(asset)
  }
  return { css: [...found.css], js: [...found.js] }
}

function sum(assets: readonly string[], sizeOf: (asset: string) => number) {
  return assets.reduce((total, asset) => total + sizeOf(asset), 0)
}

function measurePages(
  pages: readonly { path: string; html: string }[],
  sizeOf: (asset: string) => number
): PageSize[] {
  const assets = pages.map((page) => pageAssets(page.html))
  const [first, ...rest] = assets.map((page) => new Set(page.js))
  const shell = new Set(
    [...(first ?? [])].filter((asset) =>
      rest.every((other) => other.has(asset))
    )
  )
  return pages.map(({ path }, at) => {
    const { css = [], js = [] } = assets[at] ?? {}
    return {
      css: sum(css, sizeOf),
      js: sum(js, sizeOf),
      path,
      routeJs: sum(
        js.filter((asset) => !shell.has(asset)),
        sizeOf
      ),
    }
  })
}

function budgetProblems(pages: readonly PageSize[]): string[] {
  return pages.flatMap((page) =>
    [
      ["cold-entry JS", page.js, BUDGETS.js],
      ["route-specific JS", page.routeJs, BUDGETS.routeJs],
      ["first-view CSS", page.css, BUDGETS.css],
    ]
      .filter(([, size, budget]) => Number(size) > Number(budget))
      .map(
        ([label, size, budget]) =>
          `${page.path}: ${label} ${size} B, budget ${budget} B`
      )
  )
}

function brotliSize(bytes: Uint8Array): number {
  return brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY },
  }).length
}

const PORT = 4300
const READY_TRIES = 50
const READY_WAIT_MS = 100

async function waitForServer(base: string, tries = READY_TRIES): Promise<void> {
  try {
    await fetch(base)
  } catch (error) {
    if (tries === 0) {
      throw error
    }
    await Bun.sleep(READY_WAIT_MS)
    await waitForServer(base, tries - 1)
  }
}

// The server HTML of every page, from the production build on fixtures.
async function fetchPages(): Promise<{ path: string; html: string }[]> {
  // No database: Bun would otherwise load DATABASE_URL from .env.local (D30).
  const server = Bun.spawn(["bun", ".output/server/index.mjs"], {
    env: {
      ...process.env,
      DATABASE_URL: "",
      GERCH_REPLAY_DIR: "test/fixtures",
      PORT: String(PORT),
    },
    stdout: "ignore",
  })
  try {
    const base = `http://localhost:${PORT}`
    await waitForServer(base)
    return await Promise.all(
      PAGES.map(async (path) => {
        const response = await fetch(`${base}${path}`)
        return { html: await response.text(), path }
      })
    )
  } finally {
    server.kill()
  }
}

async function brotliSizes(
  pages: readonly { html: string }[]
): Promise<Map<string, number>> {
  const assets = new Set(
    pages.flatMap(({ html }) => {
      const { css, js } = pageAssets(html)
      return [...css, ...js]
    })
  )
  const sizes = await Promise.all(
    [...assets].map(async (asset) => {
      const bytes = await Bun.file(`.output/public${asset}`).bytes()
      return [asset, brotliSize(bytes)] as const
    })
  )
  return new Map(sizes)
}

async function main(): Promise<number> {
  const pages = await fetchPages()
  const sizes = await brotliSizes(pages)
  const measured = measurePages(pages, (asset) => sizes.get(asset) ?? 0)
  console.table(measured)
  const problems = budgetProblems(measured)
  for (const problem of problems) {
    console.error(problem)
  }
  return problems.length === 0 ? 0 : 1
}

if (import.meta.main) {
  process.exit(await main())
}

export { BUDGETS, budgetProblems, measurePages, pageAssets }
