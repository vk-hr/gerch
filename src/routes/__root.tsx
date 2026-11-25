import type { QueryClient } from "@tanstack/react-query"
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import type { ReactNode } from "react"
import { ThemeProvider } from "start-theme"

import { NotFound } from "@/components/not-found.tsx"
import { CopiedProvider } from "@/components/search/copied-provider.tsx"
import { WorkspaceDialogs } from "@/components/workspaces/workspace-dialogs.tsx"
import { ShortcutList } from "@/components/shortcuts/shortcut-list.tsx"
import { TabStrip } from "@/components/tabs/tab-strip.tsx"
import appCss from "@/styles.css?url"

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      links: [{ href: appCss, rel: "stylesheet" }],
      meta: [
        { charSet: "utf-8" },
        { content: "width=device-width, initial-scale=1", name: "viewport" },
        { title: "gerch" },
        {
          content:
            "One keyboard-first search across npm, crates.io and nixpkgs.",
          name: "description",
        },
      ],
    }),
    notFoundComponent: NotFound,
    shellComponent: RootDocument,
  }
)

function RootDocument({ children }: { children: ReactNode }) {
  return (
    // The theme script sets the class and color-scheme on <html> before
    // React hydrates, so those attributes differ from the server markup.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-svh antialiased">
        {/* Always "system": the server renders one page for every visitor,
            and the inline script resolves it before the first paint (D29). */}
        <ThemeProvider theme="system">
          <CopiedProvider>
            <TabStrip />
            <WorkspaceDialogs />
            <ShortcutList />
            {children}
          </CopiedProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
