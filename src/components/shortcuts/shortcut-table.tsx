import { useFormatForDisplay } from "@tanstack/react-hotkeys"

import { HOTKEYS } from "@/hotkeys.ts"

import { shortcutRows } from "./shortcut-rows.ts"

const ROWS = shortcutRows(HOTKEYS)

// Every entry of the hotkey table, one row per action.
function ShortcutTable() {
  const format = useFormatForDisplay()
  return (
    <table className="w-full">
      <thead className="sr-only">
        <tr>
          <th scope="col">Action</th>
          <th scope="col">Keys</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => (
          <tr className="border-t border-border" key={row.label}>
            <th className="py-1.5 pr-4 text-left font-normal" scope="row">
              {row.label}
            </th>
            <td className="py-1.5 text-right whitespace-nowrap">
              {row.keys.map((keys) => (
                <kbd
                  className="ml-1 rounded-md border border-border bg-muted px-1.5 py-0.5 font-heading text-xs"
                  key={keys}
                >
                  {format(keys)}
                </kbd>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export { ShortcutTable }
