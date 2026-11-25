import { describe, expect, test } from "vitest"

import type { Pin, Workspace } from "@/client/state.ts"
import {
  addPin,
  createWorkspace,
  deleteWorkspace,
  freshestSummary,
  matchingWorkspaces,
  pickerOptions,
  removePin,
} from "@/components/workspaces/workspaces.ts"
import type { PackageSummary } from "@/shared/registry.ts"

function summary(partial: Partial<PackageSummary> = {}): PackageSummary {
  return {
    description: "TypeScript-first schema validation",
    downloads: { count: 100, window: "week" },
    homepage: null,
    install: "npm i zod",
    license: "MIT",
    name: "zod",
    registry: "npm",
    releasedAt: "2026-01-01T00:00:00.000Z",
    repository: null,
    version: "4.0.0",
    ...partial,
  }
}

function pinOf(partial: Partial<PackageSummary> = {}): Pin {
  const snapshot = summary(partial)
  return { name: snapshot.name, registry: snapshot.registry, summary: snapshot }
}

const zod = pinOf()
const react = pinOf({ install: "npm i react", name: "react" })
const deps: Workspace = { id: "w1", name: "portfolio deps", pins: [zod] }
const tools: Workspace = { id: "w2", name: "tools", pins: [] }

describe("workspaces", () => {
  test("adds a pin to the end of its workspace only", () => {
    expect.hasAssertions()
    const next = addPin([deps, tools], "w1", react)
    expect(next[0]?.pins).toStrictEqual([zod, react])
    expect(next[1]).toBe(tools)
  })

  test("pinning a package twice keeps one pin", () => {
    expect.hasAssertions()
    const workspaces = [deps]
    expect(addPin(workspaces, "w1", pinOf({ version: "4.1.0" }))).toBe(
      workspaces
    )
  })

  test("the same name in another registry is another package", () => {
    expect.hasAssertions()
    const crate = pinOf({ install: "cargo add zod", registry: "crate" })
    expect(addPin([deps], "w1", crate)[0]?.pins).toHaveLength(2)
  })

  test("creates a workspace with a trimmed name", () => {
    expect.hasAssertions()
    const created = createWorkspace([tools], "  portfolio deps ", "w9")
    expect(created.id).toBe("w9")
    expect(created.workspaces).toStrictEqual([
      tools,
      { id: "w9", name: "portfolio deps", pins: [] },
    ])
  })

  test("creating a name that exists reuses that workspace", () => {
    expect.hasAssertions()
    const workspaces = [deps]
    const created = createWorkspace(workspaces, "Portfolio Deps", "w9")
    expect(created).toStrictEqual({ id: "w1", workspaces })
  })

  test("removes one pin and keeps the rest", () => {
    expect.hasAssertions()
    const both = { ...deps, pins: [zod, react] }
    expect(removePin([both], "w1", zod)[0]?.pins).toStrictEqual([react])
  })

  test("deletes a workspace with its pins", () => {
    expect.hasAssertions()
    expect(deleteWorkspace([deps, tools], "w1")).toStrictEqual([tools])
  })
})

describe("freshest summary", () => {
  test("falls back to the pin's snapshot when nothing is cached", () => {
    expect.hasAssertions()
    expect(freshestSummary(zod, [])).toBe(zod.summary)
    const other = summary({ name: "zod-to-json" })
    expect(freshestSummary(zod, [{ results: [other], updatedAt: 1 }])).toBe(
      zod.summary
    )
  })

  test("prefers the newest cached search result for the package", () => {
    expect.hasAssertions()
    const older = summary({ version: "4.1.0" })
    const newer = summary({ version: "4.2.0" })
    const cached = [
      { results: [older], updatedAt: 1 },
      { results: [newer], updatedAt: 2 },
    ]
    expect(freshestSummary(zod, cached)).toBe(newer)
  })

  test("keeps the snapshot when the cache holds an older release", () => {
    expect.hasAssertions()
    const stale = summary({
      releasedAt: "2025-01-01T00:00:00.000Z",
      version: "3.0.0",
    })
    expect(freshestSummary(zod, [{ results: [stale], updatedAt: 9 }])).toBe(
      zod.summary
    )
  })
})

describe("picker options", () => {
  test("matches workspace names ignoring case and spaces", () => {
    expect.hasAssertions()
    expect(matchingWorkspaces([deps, tools], " DEPS")).toStrictEqual([deps])
    expect(matchingWorkspaces([deps, tools], "")).toStrictEqual([deps, tools])
  })

  test("lists every workspace and marks where the package is pinned", () => {
    expect.hasAssertions()
    expect(pickerOptions([deps, tools], "", zod)).toStrictEqual([
      { kind: "workspace", pinned: true, workspace: deps },
      { kind: "workspace", pinned: false, workspace: tools },
    ])
  })

  test("filters by name and offers to create a new one", () => {
    expect.hasAssertions()
    expect(pickerOptions([deps, tools], " Port ", zod)).toStrictEqual([
      { kind: "workspace", pinned: true, workspace: deps },
      { kind: "create", name: "Port" },
    ])
  })

  test("does not offer to create a name that exists", () => {
    expect.hasAssertions()
    expect(pickerOptions([deps], "PORTFOLIO DEPS", zod)).toStrictEqual([
      { kind: "workspace", pinned: true, workspace: deps },
    ])
  })
})
