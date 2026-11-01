import type { CodeHighlighter } from "@tanstack/markdown"

import { createHighlighter } from "@tanstack/highlight/core"
import { css } from "@tanstack/highlight/languages/css"
import { html } from "@tanstack/highlight/languages/html"
import { js } from "@tanstack/highlight/languages/js"
import { json } from "@tanstack/highlight/languages/json"
import { markdown } from "@tanstack/highlight/languages/markdown"
import { nix } from "@tanstack/highlight/languages/nix"
import { plaintext } from "@tanstack/highlight/languages/plaintext"
import { rust } from "@tanstack/highlight/languages/rust"
import { shell } from "@tanstack/highlight/languages/shell"
import { toml } from "@tanstack/highlight/languages/toml"
import { ts } from "@tanstack/highlight/languages/ts"
import { tsx } from "@tanstack/highlight/languages/tsx"
import { yaml } from "@tanstack/highlight/languages/yaml"
import { createTanStackMarkdownHighlighter } from "@tanstack/highlight/markdown"

const highlighter = createHighlighter({
  languages: [
    plaintext,
    html,
    css,
    js,
    ts,
    tsx,
    json,
    yaml,
    toml,
    markdown,
    nix,
    rust,
    shell,
  ],
})

export const highlightMarkdownCode: CodeHighlighter =
  createTanStackMarkdownHighlighter(highlighter)
