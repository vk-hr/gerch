import { describe, expect, test } from "vitest"

import { EMPTY_STATE } from "@/client/state.ts"
import type { ClientState, Tab } from "@/client/state.ts"
import {
  activateTab,
  CLOSED_TABS_CAP,
  closeTab,
  followFirstRoute,
  followRoute,
  moveTab,
  openNextToActive,
  reopenTab,
  showInActiveTab,
  stepTab,
} from "@/components/tabs/tab-list.ts"

const zodSearch: Tab = { id: "a", kind: "search", query: "zod" }
const zodPackage: Tab = {
  id: "b",
  kind: "package",
  name: "zod",
  registry: "npm",
}
const reactSearch: Tab = { id: "c", kind: "search", query: "react" }

function state(tabs: Tab[], activeTab: string | null): ClientState {
  return { ...EMPTY_STATE, activeTab, tabs }
}

const ids = (current: ClientState) => current.tabs.map((tab) => tab.id)

describe("following the route", () => {
  test("the first load opens a tab for a route no tab shows", () => {
    expect.hasAssertions()
    const next = followFirstRoute(
      state([zodSearch], "a"),
      { kind: "search", query: "react" },
      "n"
    )
    expect(next.tabs).toStrictEqual([
      zodSearch,
      { id: "n", kind: "search", query: "react" },
    ])
    expect(next.activeTab).toBe("n")
  })

  test("the first load keeps the saved tabs when the active one matches", () => {
    expect.hasAssertions()
    const saved = state([zodSearch, zodPackage], "b")
    expect(
      followFirstRoute(
        saved,
        { kind: "package", name: "zod", registry: "npm" },
        "n"
      )
    ).toBe(saved)
  })

  test("back to a route another tab shows activates that tab", () => {
    expect.hasAssertions()
    const next = followRoute(
      state([zodSearch, reactSearch], "c"),
      { kind: "search", query: "zod" },
      "n"
    )
    expect(next.activeTab).toBe("a")
    expect(next.tabs).toStrictEqual([zodSearch, reactSearch])
  })

  test("a new route replaces the active tab's content", () => {
    expect.hasAssertions()
    const next = followRoute(
      state([zodSearch, reactSearch], "c"),
      { kind: "package", name: "react", registry: "npm" },
      "n"
    )
    expect(next.tabs[1]).toStrictEqual({
      id: "c",
      kind: "package",
      name: "react",
      registry: "npm",
    })
    expect(next.activeTab).toBe("c")
  })

  test("with no tabs, the route becomes the first tab", () => {
    expect.hasAssertions()
    const next = followRoute(EMPTY_STATE, { kind: "search", query: "" }, "n")
    expect(next.tabs).toStrictEqual([{ id: "n", kind: "search", query: "" }])
    expect(next.activeTab).toBe("n")
  })
})

describe("opening", () => {
  test("showInActiveTab changes the active tab even if another tab matches", () => {
    expect.hasAssertions()
    const next = showInActiveTab(
      state([zodSearch, zodPackage], "a"),
      { kind: "package", name: "zod", registry: "npm" },
      "n"
    )
    expect(next.tabs[0]).toStrictEqual({ ...zodPackage, id: "a" })
    expect(next.activeTab).toBe("a")
  })

  test("openNextToActive inserts after the active tab and keeps it active", () => {
    expect.hasAssertions()
    const next = openNextToActive(
      state([zodSearch, reactSearch], "a"),
      { kind: "package", name: "zod", registry: "npm" },
      "n"
    )
    expect(ids(next)).toStrictEqual(["a", "n", "c"])
    expect(next.activeTab).toBe("a")
  })
})

describe("switching and moving", () => {
  const three = state([zodSearch, zodPackage, reactSearch], "a")

  test("stepTab wraps around both ends", () => {
    expect.hasAssertions()
    expect(stepTab(three, 1).activeTab).toBe("b")
    expect(stepTab(three, -1).activeTab).toBe("c")
    expect(stepTab({ ...three, activeTab: "c" }, 1).activeTab).toBe("a")
  })

  test("moveTab swaps with a neighbour and stops at the ends", () => {
    expect.hasAssertions()
    expect(ids(moveTab(three, 1))).toStrictEqual(["b", "a", "c"])
    expect(moveTab(three, -1)).toBe(three)
    expect(moveTab(three, 1).activeTab).toBe("a")
  })

  test("activateTab ignores an unknown id", () => {
    expect.hasAssertions()
    expect(activateTab(three, "c").activeTab).toBe("c")
    expect(activateTab(three, "nope")).toBe(three)
  })
})

describe("closing and reopening", () => {
  test("closing the active tab activates its right neighbour, else its left", () => {
    expect.hasAssertions()
    const three = state([zodSearch, zodPackage, reactSearch], "b")
    expect(closeTab(three, "b", "n").activeTab).toBe("c")
    expect(closeTab({ ...three, activeTab: "c" }, "c", "n").activeTab).toBe("b")
  })

  test("closing another tab keeps the active one", () => {
    expect.hasAssertions()
    const next = closeTab(state([zodSearch, zodPackage], "a"), "b", "n")
    expect(ids(next)).toStrictEqual(["a"])
    expect(next.activeTab).toBe("a")
    expect(next.closedTabs).toStrictEqual([zodPackage])
  })

  test("closing the last tab leaves one empty search tab", () => {
    expect.hasAssertions()
    const next = closeTab(state([zodSearch], "a"), "a", "n")
    expect(next.tabs).toStrictEqual([{ id: "n", kind: "search", query: "" }])
    expect(next.activeTab).toBe("n")
  })

  test(`keeps the last ${CLOSED_TABS_CAP} closed tabs, newest first`, () => {
    expect.hasAssertions()
    const many = [...Array.from({ length: CLOSED_TABS_CAP + 5 }).keys()].map(
      (index): Tab => ({ id: `t${index}`, kind: "search", query: `${index}` })
    )
    const closed = many.reduce(
      (current, tab) => closeTab(current, tab.id, "n"),
      state(many, "t0")
    )
    expect(closed.closedTabs).toHaveLength(CLOSED_TABS_CAP)
    expect(closed.closedTabs[0]?.id).toBe(`t${CLOSED_TABS_CAP + 4}`)
  })

  test("reopening restores the last closed tab after the active one", () => {
    expect.hasAssertions()
    const closed = closeTab(
      state([zodSearch, zodPackage, reactSearch], "b"),
      "b",
      "n"
    )
    const reopened = reopenTab({ ...closed, activeTab: "a" })
    expect(ids(reopened)).toStrictEqual(["a", "b", "c"])
    expect(reopened.activeTab).toBe("b")
    expect(reopened.closedTabs).toStrictEqual([])
    expect(reopenTab(reopened)).toBe(reopened)
  })
})
