import type { QueryClient } from "@tanstack/react-query"

import { AppSidebar } from "@/components/app-sidebar"
import { getSidebarOpenState } from "@/server/sidebar"
import { getTheme, setTheme } from "@/theme"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { hotkeysDevtoolsPlugin } from "@tanstack/react-hotkeys-devtools"
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools"
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { ThemeProvider } from "start-theme"

import appCss from "../styles.css?url"

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  loader: async () => {
    const [theme, isSidebarOpen] = await Promise.all([
      getTheme(),
      getSidebarOpenState(),
    ])
    return { theme, isSidebarOpen }
  },
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { theme, isSidebarOpen } = Route.useLoaderData()
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          theme={theme}
          setThemeFn={(next) => setTheme({ data: next })}
        >
          <AppSidebar defaultOpen={isSidebarOpen}>{children}</AppSidebar>
        </ThemeProvider>
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
            {
              name: "TanStack Query",
              render: <ReactQueryDevtoolsPanel />,
            },
            hotkeysDevtoolsPlugin(),
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
