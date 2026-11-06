import { ThemeToggle } from "@/components/theme-toggle"
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { pinsQueryOptions } from "@/lib/pins"
import { closeTab, workspaceStore } from "@/lib/workspace"
import { useHotkey } from "@tanstack/react-hotkeys"
import { useQuery } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { useStore } from "@tanstack/react-store"
import { PinIcon, XIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

export function AppSidebar({
  children,
  defaultOpen,
}: {
  children: ReactNode
  defaultOpen: boolean
}) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen} className="h-svh">
        <AppSidebarLayout>{children}</AppSidebarLayout>
      </SidebarProvider>
    </TooltipProvider>
  )
}

function AppSidebarLayout({ children }: { children: ReactNode }) {
  const { open, toggleSidebar } = useSidebar()
  const { tabs } = useStore(workspaceStore, (state) => state)
  const pins = useQuery(pinsQueryOptions)
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useHotkey(["Space", "S"], toggleSidebar)
  useHotkey(["Space", "F"], () => {
    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="Search packages"]'
    )
    if (input) {
      input.focus()
      return
    }
    void navigate({ to: "/{-$query}", params: { query: undefined } })
  })

  return (
    <>
      <Sidebar variant="inset" collapsible="offcanvas">
        <SidebarHeader>
          <SidebarTrigger />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Pinned</SidebarGroupLabel>
            <SidebarGroupContent>
              {(pins.data ?? []).length === 0 ? (
                <Empty className="py-4">
                  <EmptyHeader>
                    <EmptyDescription>Nothing pinned yet.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <SidebarMenu>
                  {(pins.data ?? []).map((pin) => (
                    <SidebarMenuItem key={`${pin.registry}:${pin.name}`}>
                      <SidebarMenuButton
                        tooltip={pin.name}
                        render={
                          <Link
                            to="/$registry/$name"
                            params={{
                              registry: pin.registry,
                              name: encodeURIComponent(pin.name),
                            }}
                          />
                        }
                      >
                        <PinIcon />
                        {pin.name}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Open tabs</SidebarGroupLabel>
            <SidebarGroupContent>
              {!mounted ? null : tabs.length === 0 ? (
                <Empty className="py-4">
                  <EmptyHeader>
                    <EmptyDescription>No packages open.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <SidebarMenu>
                  {tabs.map((tab) => (
                    <SidebarMenuItem key={`${tab.registry}:${tab.name}`}>
                      <SidebarMenuButton
                        tooltip={tab.name}
                        render={
                          <Link
                            to="/$registry/$name"
                            params={{
                              registry: tab.registry,
                              name: encodeURIComponent(tab.name),
                            }}
                          />
                        }
                      >
                        {tab.name}
                      </SidebarMenuButton>
                      <SidebarMenuAction
                        aria-label={`Close tab ${tab.name}`}
                        onClick={() => closeTab(tab)}
                      >
                        <XIcon />
                      </SidebarMenuAction>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <ThemeToggle />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-h-0 overflow-y-auto">
        {!open && (
          <div className="absolute top-4 left-4 z-20">
            <SidebarTrigger />
          </div>
        )}
        {children}
      </SidebarInset>
    </>
  )
}
