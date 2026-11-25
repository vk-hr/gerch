import type { UseNavigateResult } from "@tanstack/react-router"

import type { TabContent } from "./tab-list.ts"

async function goToTab(
  navigate: UseNavigateResult<string>,
  content: TabContent,
  replace: boolean
) {
  await (content.kind === "search"
    ? navigate({
        replace,
        search: content.query === "" ? {} : { q: content.query },
        to: "/",
      })
    : navigate({
        params: { name: content.name, registry: content.registry },
        replace,
        to: "/p/$registry/$name",
      }))
}

export { goToTab }
