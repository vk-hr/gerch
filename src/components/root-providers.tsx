import type { ReactNode } from "react"
import { ThemeProvider } from "start-theme"

import { CopiedProvider } from "@/components/search/copied-provider.tsx"
import { ShortcutList } from "@/components/shortcuts/shortcut-list.tsx"
import { TabStrip } from "@/components/tabs/tab-strip.tsx"
import { VitalsReporter } from "@/components/vitals-reporter.tsx"
import { WorkspaceDialogs } from "@/components/workspaces/workspace-dialogs.tsx"

// Everything every page shares inside <body>: the theme, copy feedback, the
// tab strip, the app-wide dialogs and field vitals.
function RootProviders({ children }: { children: ReactNode }) {
  return (
    <>
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
      <VitalsReporter />
    </>
  )
}

export { RootProviders }
