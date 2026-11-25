import type { QueryClient } from "@tanstack/react-query"
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import type { ReactNode } from "react"

import { NotFound } from "@/components/not-found.tsx"
import { WorkspaceDialogs } from "@/components/workspaces/workspace-dialogs.tsx"
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
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-svh antialiased">
        <WorkspaceDialogs />
        {children}
        <Scripts />
      </body>
    </html>
  )
}
