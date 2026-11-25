import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { redact } from "@tanstack/redact/vite"
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"
import type { PluginOption } from "vite"

// The browser renderer: Redact, which won the comparison (D34), or React DOM
// with GERCH_RENDERER=react-dom. The server always renders with React DOM
// (D10).
const browserRenderer: PluginOption[] =
  process.env.GERCH_RENDERER === "react-dom"
    ? []
    : [redact({ environments: ["client"] }) as PluginOption]

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    // Start turns on the router's autoCodeSplitting itself.
    tanstackStart({ router: { quoteStyle: "double", semicolons: false } }),
    nitro(),
    tailwindcss(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
    ...browserRenderer,
  ],
})
