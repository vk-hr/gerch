// Every keyboard shortcut, in one place (docs/spec.md, "Keyboard map"). The
// shortcut list (`?`) renders from this table too.
const HOTKEYS = {
  clear: {
    keys: "Escape",
    label: "Clear the query, then leave the search box",
  },
  closeTab: { keys: "Alt+X", label: "Close the current tab" },
  copy: { keys: "Alt+C", label: "Copy the install command" },
  focusSearch: { keys: "/", label: "Focus the search box" },
  focusSearchMod: { keys: "Mod+K", label: "Focus the search box" },
  moveTabLeft: { keys: "Alt+Shift+,", label: "Move the current tab left" },
  moveTabRight: { keys: "Alt+Shift+.", label: "Move the current tab right" },
  next: { keys: "ArrowDown", label: "Next result" },
  nextAlt: { keys: "Control+N", label: "Next result" },
  nextTab: { keys: "Alt+.", label: "Next tab" },
  open: { keys: "Enter", label: "Open the result in the current tab" },
  openInNewTab: {
    keys: "Shift+Enter",
    label: "Open the result in a new tab next to the current one",
  },
  pin: { keys: "Alt+P", label: "Pin the result to a workspace" },
  previous: { keys: "ArrowUp", label: "Previous result" },
  previousAlt: { keys: "Control+P", label: "Previous result" },
  previousTab: { keys: "Alt+,", label: "Previous tab" },
  reopenTab: { keys: "Alt+Shift+X", label: "Reopen the last closed tab" },
  shortcuts: { keys: "Shift+?", label: "Show the shortcut list" },
  workspaces: { keys: "Alt+W", label: "Open the workspace switcher" },
} as const

export { HOTKEYS }
