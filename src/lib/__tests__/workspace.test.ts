import { closeTab, openTab, workspaceStore } from "@/lib/workspace"
import { describe, expect, it } from "vitest"

describe("workspace tabs", () => {
  it("opens a tab once per package", () => {
    workspaceStore.setState((state) => ({ ...state, tabs: [] }))
    openTab({ registry: "npm", name: "react" })
    openTab({ registry: "npm", name: "react" })
    expect(workspaceStore.state.tabs).toHaveLength(1)
  })

  it("closes only the matching tab", () => {
    workspaceStore.setState((state) => ({ ...state, tabs: [] }))
    openTab({ registry: "npm", name: "react" })
    openTab({ registry: "crates", name: "serde" })
    closeTab({ registry: "npm", name: "react" })
    expect(workspaceStore.state.tabs).toEqual([
      { registry: "crates", name: "serde" },
    ])
  })
})
