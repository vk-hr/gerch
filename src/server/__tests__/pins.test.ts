import { openDb } from "@/server/db.server"
import { createPinStore } from "@/server/pins.server"
import { describe, expect, it } from "vitest"

describe("createPinStore", () => {
  it("adds, lists, and removes pins", () => {
    const store = createPinStore(openDb(":memory:"))

    store.add("npm", "react")
    store.add("crates", "serde")
    expect(store.list()).toEqual([
      { registry: "npm", name: "react" },
      { registry: "crates", name: "serde" },
    ])

    store.remove("npm", "react")
    expect(store.list()).toEqual([{ registry: "crates", name: "serde" }])
  })

  it("does not duplicate a pin added twice", () => {
    const store = createPinStore(openDb(":memory:"))
    store.add("npm", "react")
    store.add("npm", "react")
    expect(store.list()).toHaveLength(1)
  })

  it("keeps pins across store instances on the same database", () => {
    const db = openDb(":memory:")
    createPinStore(db).add("npm", "react")
    expect(createPinStore(db).list()).toEqual([
      { registry: "npm", name: "react" },
    ])
  })
})
