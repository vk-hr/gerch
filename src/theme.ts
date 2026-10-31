import { createServerFn } from "@tanstack/react-start"
import { createThemeCookie } from "start-theme/server"

const themeCookie = createThemeCookie({ key: "gerch-theme" })

export const getTheme = createServerFn({ method: "GET" }).handler(() =>
  themeCookie.read()
)

export const setTheme = createServerFn({ method: "POST" })
  .validator((value) => themeCookie.validate(value))
  .handler(({ data }) => themeCookie.write(data))
