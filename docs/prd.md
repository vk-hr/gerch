# gerch — PRD

Personal, keyboard-first web app for searching npm, crates.io, and nixpkgs in one UI. Single user, no auth. gerch exists to kill registry hopping: during polyglot work, package lookups currently mean three different UIs; gerch gives them one interaction model with fast access to links, metadata, installation commands, and the readme.

## Goals

- Find a package in any of the three registries and reach its repo/docs links in seconds, keyboard-only.
- Keep a working set of packages open (tabs) and mark the durable ones (pins) that survive anywhere.
- Make every package page a useful reference: understand what the package is, how to install it, where its source and documentation live, and read its readme.
- Present one visual language for heterogeneous registries without hiding meaningful registry-specific metadata.
- Degrade honestly: valid data remains usable when an upstream payload, backend, or secondary resource partially fails.

## Non-goals (v1)

- Blended cross-registry ranking (registry tabs instead).
- Dependency graphs, download charts, dependency trees.
- Auth / multi-user. NixOS option search. Docs corpus / local grep (parked research track). PowerSync (parked until docs-grep proves out).
- Search history, additional filters, or changes to the existing search interaction model.
- A new nixpkgs detail/readme backend in the current hardening phases. First make the existing search-derived detail path correct and useful; evaluate any dedicated detail source separately.

## Users

The author. Runs locally or on a personal box; no accounts.

## Requirements

### Search

- Single query box, three registry tabs (npm / crates / nixpkgs).
- Only the active tab fires; refetches on tab switch; ~200ms debounce as-you-type; Enter forces. Per-registry TanStack Query cache (`['search', registry, q, ...]`).
- Exact-name match in the active registry navigates straight to the package route.
- npm qualifier syntax (keywords:, author:, ...) passes through.
- Results: first page ~20-25, infinite scroll, virtualized (@tanstack/react-virtual).
- Keyboard: Mod+K focuses search, arrows/Enter on results, Escape blurs.
- Loading, error/retry, empty, and partial-degradation states are consistent across registries. Partial results remain visible when some upstream records cannot be mapped; degraded does not mean empty.
- Nix schema drift is never reported as a successful empty search. Valid hits are retained where possible, dropped hits mark the result degraded, and schema-failure outcomes are not cached.

### Package detail

Routes `/:registry/:name` remain the addressable unit. Every registry uses the same information hierarchy while retaining useful registry-specific content:

1. **Identity and actions** — full package name, registry, current version/channel, description, pin control, and relevant external actions.
2. **Installation** — copyable, registry-appropriate commands: `npm install <name>`, `cargo add <name>`, and `nix profile install nixpkgs#<full-attribute-path>`. Only emit identifiers actually present in the record; never infer a nix `pname` from an attribute path.
3. **Metadata and links** — license(s), downloads where supplied, homepage/repository/docs/issues links, and all homepage/license values supplied by nixpkgs.
4. **Versions** — collapsed by default, with the current/latest version marked and a bounded, scrollable list when expanded. No version analytics.
5. **Readme** — readable documentation with appropriate typography for headings, lists, tables, links, images, and code blocks.

Additional behavior:

- Nix detail uses the existing search backend and exact attribute-path match. It does not fabricate metadata, versions, or a readme.
- Nix package URLs support an optional `?channel=` value. The saved channel is the default; an explicit channel overrides it and participates in the loader/query key. Unsupported channel values fail validation rather than silently searching another channel.
- The selected nix channel is visible on the detail page.
- Sparse packages look intentionally minimal, not broken. A package without a readme still presents its metadata and installation path.

### Failure and empty states

- Metadata, readme, and auxiliary resources fail independently. A docs.rs or unpkg failure cannot discard successfully loaded package metadata.
- A genuinely missing package uses a not-found presentation with a path back to search. It is not conflated with an unavailable backend.
- An upstream outage shows a retryable alert and preserves whatever metadata is available.
- A readme-only failure leaves the rest of the page intact and shows a small readme-unavailable note.
- Package routes have deliberate pending, sparse, and error presentations. There is no empty fallback package that merely echoes the route name.

### Views & state

- The tab strip is client state.
- Sidebar: pinned packages section first, open tabs below; collapsible (Mod+B); opening a pin opens/reuses a tab.
- Session tabs persist in localStorage. Pins persist server-side (node:sqlite behind Start server functions — the same API runs on Bun and Node, so the pin store is unit-testable).
- Light/dark theme persists through the SSR theme cookie and applies to package metadata and readme content.

### Registries (all accessed via Start server functions — one proxy path)

Identifying User-Agent set once; upstream caching respected; rate queues where required. Server-only helpers stay isolated from universal server-function modules so client and production builds cannot pull them into the browser graph.

- npm: `/-/v1/search` (score + downloads in hits). Readme: registry doc, unpkg tarball README.md fallback when the registry readme is empty. Metadata survives fallback failure.
- crates.io: `/api/v1/crates?q=`; max 1 req/s queue; readme = docs.rs pre-rendered HTML, sanitized (never markdown-rendered); license is detail-only. docs.rs failure preserves crate metadata. Relative readme links and images are rebased before sanitization.
- nixpkgs: search.nixos.org Elasticsearch backend (undocumented; creds from their public frontend bundle, held in SERVER_ env). Packages only. Channel switcher, unstable default, channel in the query key. Runtime-pinned schema version, aggressive caching of valid responses, graceful degradation on genuine failure. Mapping tolerates nullable upstream fields, including `spdxId: null`, and preserves valid records during partial schema drift.

### Readme rendering

- npm Markdown uses @tanstack/markdown with allowHtml, repository-aware URL resolution, and server-side sanitization.
- crates docs.rs HTML is extracted and sanitized without Markdown rendering; relative URLs are rebased.
- Sanitization continues to strip scripts, event handlers, unsafe schemes, and arbitrary inline styles/IDs while permitting common documentation markup.
- Readme links open externally with safe `rel` values.
- Tables, images, and code blocks are responsive and cannot create accidental page-level horizontal overflow. Readme typography uses the active light/dark theme.

### Quality

- Registry mapping is covered by unit tests against recorded upstream payloads, including realistic nullable fields and partial schema drift.
- Nix regressions include a payload with `spdxId: null`; valid records must survive while degraded results and caching behavior are asserted.
- Live contract checks (404/429, schema drift) run on demand and never in CI. `ripgrep` is the control query; `firefox`, `hello`, `vim`, `docker`, and `linux` are required regression queries because they previously produced upstream hits but false empty results.
- Package detail unit/contract coverage proves that docs.rs and unpkg failures preserve metadata, and that missing packages, outages, and invalid channels remain distinct.
- E2E covers SSR, keyboard flow, tabs and pins, channel-aware nix deep links, sparse package pages, and readme-unavailable states.
- Lint, formatting, typecheck, unit tests, e2e, and the production build must all pass.

## Success criteria

- Exact-name to package view in <= 2 keystrokes + Enter.
- Cold search to visible results per registry <= ~300ms beyond network.
- Tab/pin restore on reload; pins survive server restarts.
- The required nix regression queries return mapped results whenever upstream returns valid hits; no false empty search is caused by one nullable license.
- A channel-specific nix link renders the same package on another load without silently changing channels.
- A package page provides a correct installation command and useful metadata even when its readme or another secondary resource is unavailable.
- A secondary-resource failure never turns a valid package page into an empty page or a full-route error.
