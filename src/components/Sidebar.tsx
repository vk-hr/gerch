import { closeTab, toggleCollapsed, workspaceStore } from "@/lib/workspace"
import { listPins } from "@/server/pins"
import { useHotkey } from "@tanstack/react-hotkeys"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useStore } from "@tanstack/react-store"
import { useEffect, useState } from "react"

export function Sidebar() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { tabs, collapsed } = useStore(workspaceStore, (state) => state)
  const pins = useQuery({ queryKey: ["pins"], queryFn: () => listPins() })

  useHotkey("Mod+B", (event) => {
    event.preventDefault()
    toggleCollapsed()
  })

  return (
    <aside
      className={`flex shrink-0 flex-col gap-4 border-r p-4 transition-all ${
        collapsed ? "w-12" : "w-64"
      }`}
    >
      <button
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="self-start rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent"
      >
        {collapsed ? "»" : "«"}
      </button>

      {!collapsed && mounted && (
        <>
          <section>
            <h2 className="mb-2 text-xs font-medium text-muted-foreground uppercase">
              Pinned
            </h2>
            <ul className="space-y-1 text-sm">
              {(pins.data ?? []).map((pin) => (
                <li key={`${pin.registry}:${pin.name}`}>
                  <Link
                    to="/$registry/$name"
                    params={{
                      registry: pin.registry,
                      name: encodeURIComponent(pin.name),
                    }}
                    className="block truncate rounded px-1 py-0.5 hover:bg-accent"
                  >
                    {pin.name}
                  </Link>
                </li>
              ))}
              {(pins.data ?? []).length === 0 && (
                <li className="text-xs text-muted-foreground">
                  Nothing pinned yet.
                </li>
              )}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium text-muted-foreground uppercase">
              Open tabs
            </h2>
            <ul className="space-y-1 text-sm">
              {tabs.map((tab) => (
                <li
                  key={`${tab.registry}:${tab.name}`}
                  className="group flex items-center gap-1"
                >
                  <Link
                    to="/$registry/$name"
                    params={{
                      registry: tab.registry,
                      name: encodeURIComponent(tab.name),
                    }}
                    className="block min-w-0 flex-1 truncate rounded px-1 py-0.5 hover:bg-accent"
                  >
                    {tab.name}
                  </Link>
                  <button
                    onClick={() => closeTab(tab)}
                    aria-label={`Close tab ${tab.name}`}
                    className="rounded px-1 text-muted-foreground hover:bg-accent"
                  >
                    ×
                  </button>
                </li>
              ))}
              {tabs.length === 0 && (
                <li className="text-xs text-muted-foreground">
                  No packages open.
                </li>
              )}
            </ul>
          </section>
        </>
      )}
    </aside>
  )
}
