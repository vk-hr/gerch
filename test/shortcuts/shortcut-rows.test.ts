import { describe, expect, test } from "vitest"

import { shortcutRows } from "@/components/shortcuts/shortcut-rows.ts"
import { HOTKEYS } from "@/hotkeys.ts"

describe("shortcutRows()", () => {
  test("groups shortcuts that share a label, in table order", () => {
    expect.hasAssertions()
    expect(
      shortcutRows({
        next: { keys: "ArrowDown", label: "Next result" },
        nextAlt: { keys: "Control+N", label: "Next result" },
        shortcuts: { keys: "Shift+?", label: "Show the shortcut list" },
      })
    ).toStrictEqual([
      { keys: ["ArrowDown", "Control+N"], label: "Next result" },
      { keys: ["Shift+?"], label: "Show the shortcut list" },
    ])
  })

  test("lists every entry of the hotkey table", () => {
    expect.hasAssertions()
    const listed = shortcutRows(HOTKEYS).flatMap((row) => row.keys)
    const table = Object.values(HOTKEYS).map((hotkey) => hotkey.keys)
    expect(listed.toSorted()).toStrictEqual(table.toSorted())
  })
})
