import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"

// Kept in sync with the cookie written by the sidebar component.
const SIDEBAR_COOKIE_NAME = "sidebar_state"

export const getSidebarOpenState = createServerFn({ method: "GET" }).handler(
  async () => {
    const value = getCookie(SIDEBAR_COOKIE_NAME)
    if (value === "true") return true
    if (value === "false") return false
    return true
  }
)
