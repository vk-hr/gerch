// Every keyboard shortcut, in one place (docs/spec.md, "Keyboard map"). The
// shortcut list (`?`, step 5) renders from this table too.
const HOTKEYS = {
  clear: {
    keys: "Escape",
    label: "Clear the query, then leave the search box",
  },
  copy: { keys: "Alt+C", label: "Copy the install command" },
  focusSearch: { keys: "/", label: "Focus the search box" },
  focusSearchMod: { keys: "Mod+K", label: "Focus the search box" },
  next: { keys: "ArrowDown", label: "Next result" },
  previous: { keys: "ArrowUp", label: "Previous result" },
} as const

export { HOTKEYS }
