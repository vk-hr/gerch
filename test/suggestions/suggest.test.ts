import { describe, expect, test } from "vitest"

import type { HistoryEntry, Pin } from "@/client/state.ts"
import { suggest } from "@/components/suggestions/suggest.ts"
import type { SuggestInput } from "@/components/suggestions/suggest.ts"
import type { PackageSummary, Registry } from "@/shared/registry.ts"

const NOW = Date.UTC(2026, 10, 25)

function pin(registry: Registry, name: string): Pin {
  const summary: PackageSummary = {
    description: null,
    downloads: null,
    homepage: null,
    install: `npm i ${name}`,
    license: null,
    name,
    registry,
    releasedAt: null,
    repository: null,
    version: "1.0.0",
  }
  return { name, registry, summary }
}

function recent(
  query: string,
  registry: Registry | null,
  count = 1
): HistoryEntry {
  return { count, lastUsed: NOW, query, registry }
}

function input(partial: Partial<SuggestInput>): SuggestInput {
  return {
    history: [],
    pins: [],
    query: "zo",
    results: [],
    ...partial,
  }
}

function shape(partial: Partial<SuggestInput>): string[] {
  const suggestions = suggest(input(partial))
  return suggestions.map((item) => `${item.kind} ${item.query}`)
}

describe("suggest()", () => {
  test("lists matching pins, then history by frecency, then live results", () => {
    expect.hasAssertions()
    expect(
      shape({
        history: [recent("zod-form", null), recent("zone", "npm", 5)],
        pins: [pin("npm", "zod"), pin("npm", "react")],
        results: [
          { name: "zod", registry: "npm" },
          { name: "zod-to-json-schema", registry: "npm" },
        ],
      })
    ).toStrictEqual([
      "pin npm:zod",
      "history npm:zone",
      "history zod-form",
      "result npm:zod-to-json-schema",
    ])
  })

  test("matches the typed prefix without case", () => {
    expect.hasAssertions()
    expect(
      shape({ pins: [pin("npm", "Zod"), pin("npm", "ozone")], query: "ZO" })
    ).toStrictEqual(["pin npm:Zod"])
  })

  test("keeps to the registry a prefix picked", () => {
    expect.hasAssertions()
    expect(
      shape({
        history: [recent("zod", "npm"), recent("zoxide", "nix")],
        pins: [pin("crate", "zola"), pin("npm", "zod-mini")],
        query: "npm:zo",
      })
    ).toStrictEqual(["pin npm:zod-mini", "history npm:zod"])
  })

  test("leaves out what the box already holds and repeats", () => {
    expect.hasAssertions()
    expect(
      shape({
        history: [recent("zod", null), recent("zod", "npm")],
        pins: [pin("npm", "zod")],
        query: "zod",
        results: [{ name: "zod", registry: "npm" }],
      })
    ).toStrictEqual(["pin npm:zod"])
  })

  test("replays a history query whose text starts with a prefix", () => {
    expect.hasAssertions()
    expect(
      shape({ query: "npm:cr", history: [recent("crate:foo", "npm")] })
    ).toStrictEqual(["history npm:crate:foo"])
  })

  test("suggests nothing before any text is typed", () => {
    expect.hasAssertions()
    expect(
      shape({ history: [recent("zod", null)], query: "npm:" })
    ).toStrictEqual([])
  })

  test("offers the first three live results", () => {
    expect.hasAssertions()
    const results = Array.from({ length: 20 }, (_item, index) => ({
      name: `zod-${index}`,
      registry: "npm" as const,
    }))
    expect(shape({ results })).toStrictEqual([
      "result npm:zod-0",
      "result npm:zod-1",
      "result npm:zod-2",
    ])
  })

  test("shows at most eight suggestions", () => {
    expect.hasAssertions()
    const names = Array.from({ length: 10 }, (_item, index) => `zod-${index}`)
    const suggestions = suggest(
      input({
        history: names.map((name) => recent(`${name}-old`, null)),
        pins: names.map((name) => pin("npm", name)),
        results: names.map((name) => ({
          name: `${name}-new`,
          registry: "npm",
        })),
      })
    )
    expect(suggestions.map((item) => item.kind).join(" ")).toBe(
      "pin pin pin history history history history history"
    )
  })
})
