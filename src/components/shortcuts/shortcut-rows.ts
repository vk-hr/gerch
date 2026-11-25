interface Hotkey<TKeys extends string> {
  keys: TKeys
  label: string
}

interface ShortcutRow<TKeys extends string> {
  label: string
  keys: TKeys[]
}

// One row per action, with every key that does it, in table order.
function shortcutRows<TKeys extends string>(
  hotkeys: Readonly<Record<string, Hotkey<TKeys>>>
): ShortcutRow<TKeys>[] {
  const rows = new Map<string, TKeys[]>()
  for (const { keys, label } of Object.values(hotkeys)) {
    rows.set(label, [...(rows.get(label) ?? []), keys])
  }
  return [...rows].map(([label, keys]) => ({ keys, label }))
}

export { shortcutRows }
export type { ShortcutRow }
