import { openDb } from "@/server/db"
import { describe, expect, it } from "vitest"

describe("openDb", () => {
  it("opens an in-memory database that accepts statements", () => {
    const db = openDb(":memory:")
    db.exec("CREATE TABLE pins (id INTEGER PRIMARY KEY, name TEXT)")
    db.prepare("INSERT INTO pins (name) VALUES (?)").run("react")
    expect(db.prepare("SELECT name FROM pins").get()).toEqual({ name: "react" })
    db.close()
  })
})
