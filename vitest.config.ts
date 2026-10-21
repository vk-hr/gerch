import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [viteReact({ compiler: true })],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/__tests__/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/*.live.test.ts"],
          setupFiles: ["test/setup/unit.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "live",
          environment: "node",
          include: ["src/**/__tests__/**/*.live.test.ts"],
          exclude: ["**/node_modules/**"],
          setupFiles: ["test/setup/live.ts"],
        },
      },
    ],
  },
})
