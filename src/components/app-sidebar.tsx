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
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { pinsQueryOptions } from "@/lib/pins"
import { closeTab, setCollapsed, workspaceStore } from "@/lib/workspace"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useStore } from "@tanstack/react-store"
import { PinIcon, XIcon } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

export function AppSidebar({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { tabs, collapsed } = useStore(workspaceStore, (state) => state)
  const pins = useQuery(pinsQueryOptions)

  return (
    <TooltipProvider>
      <SidebarProvider
        open={mounted ? !collapsed : true}
        onOpenChange={(open: boolean) => setCollapsed(!open)}
      >
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarTrigger />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Pinned</SidebarGroupLabel>
              <SidebarGroupContent>
                {(pins.data ?? []).length === 0 ? (
                  <Empty className="py-4 group-data-[collapsible=icon]:hidden">
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
                  <Empty className="py-4 group-data-[collapsible=icon]:hidden">
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
        </Sidebar>
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
