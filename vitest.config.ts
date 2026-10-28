import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [viteReact({ compiler: true })],
  test: {
    coverage: {
      provider: "istanbul",
      include: ["src/**"],
      exclude: ["src/**/__tests__/**", "src/routeTree.gen.ts"],
      reporter: ["text", "html"],
    },
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
          testTimeout: 15_000,
        },
      },
    ],
  },
})
