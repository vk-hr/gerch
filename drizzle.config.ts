import { defineConfig } from "drizzle-kit"

import { databaseUrl } from "./src/server/env.ts"

export default defineConfig({
  dbCredentials: { url: databaseUrl() ?? "" },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/server/db/schema.ts",
})
