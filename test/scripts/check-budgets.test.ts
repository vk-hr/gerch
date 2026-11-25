import { describe, expect, test } from "vitest"

import {
  BUDGETS,
  budgetProblems,
  measurePages,
  pageAssets,
} from "../../scripts/check-budgets.ts"

const HOME = `<html><head>
<link rel="modulepreload" href="/assets/index-a.js">
<link rel="modulepreload" href="/assets/jsx-runtime-b.js">
<link rel="stylesheet" href="/assets/styles-c.css">
</head><body><script type="module" async src="/assets/index-a.js"></script></body></html>`

const PACKAGE = `<html><head>
<link rel="modulepreload" href="/assets/index-a.js">
<link rel="modulepreload" href="/assets/jsx-runtime-b.js">
<link rel="modulepreload" href="/assets/p._registry._name-d.js">
<link rel="stylesheet" href="/assets/styles-c.css">
</head><body></body></html>`

const SIZES = new Map<string, number>([
  ["/assets/index-a.js", 100_000],
  ["/assets/jsx-runtime-b.js", 5000],
  ["/assets/p._registry._name-d.js", 20_000],
  ["/assets/styles-c.css", 9000],
])
const sizeOf = (asset: string) => SIZES.get(asset) ?? 0

describe("pageAssets()", () => {
  test("reads scripts, module preloads and stylesheets once each", () => {
    expect.hasAssertions()
    expect(pageAssets(HOME)).toStrictEqual({
      css: ["/assets/styles-c.css"],
      js: ["/assets/index-a.js", "/assets/jsx-runtime-b.js"],
    })
  })
})

describe("measurePages()", () => {
  test("splits each page's JS into the shared shell and its own route JS", () => {
    expect.hasAssertions()
    const pages = measurePages(
      [
        { html: HOME, path: "/" },
        { html: PACKAGE, path: "/p/npm/zod" },
      ],
      sizeOf
    )
    expect(pages).toStrictEqual([
      { css: 9000, js: 105_000, path: "/", routeJs: 0 },
      { css: 9000, js: 125_000, path: "/p/npm/zod", routeJs: 20_000 },
    ])
  })
})

describe("budgetProblems()", () => {
  test("passes pages within every budget", () => {
    expect.hasAssertions()
    expect(
      budgetProblems([{ css: 9000, js: 125_000, path: "/", routeJs: 20_000 }])
    ).toStrictEqual([])
  })

  test("reports every budget a page exceeds", () => {
    expect.hasAssertions()
    expect(
      budgetProblems([
        {
          css: BUDGETS.css + 1,
          js: BUDGETS.js + 1,
          path: "/p/npm/zod",
          routeJs: BUDGETS.routeJs + 1,
        },
      ])
    ).toStrictEqual([
      "/p/npm/zod: cold-entry JS 150001 B, budget 150000 B",
      "/p/npm/zod: route-specific JS 50001 B, budget 50000 B",
      "/p/npm/zod: first-view CSS 20001 B, budget 20000 B",
    ])
  })
})
