# gerch — PRD

Personal, keyboard-first web app for searching npm, crates.io, and nixpkgs in one UI. Single user, no auth. gerch exists to kill registry hopping: during polyglot work, package lookups currently mean three different UIs; gerch gives them one interaction model with fast access to links, metadata, and the readme.

## Goals

- Find a package in any of the three registries and reach its repo/docs links in seconds, keyboard-only.
- Keep a working set of packages open (tabs) and mark the durable ones (pins) that survive anywhere.
- One visual language for heterogeneous registries.

## Non-goals (v1)

- Blended cross-registry ranking (registry tabs instead).
- Dependency graphs, download charts, dependency trees.
- Auth / multi-user. NixOS option search. Docs corpus / local grep (parked research track). PowerSync (parked until docs-grep proves out).

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

### Views & state

- Routes /:registry/:name are the addressable unit; the tab strip is client state.
- Sidebar: pinned packages section first, open tabs below; collapsible (Mod+B); opening a pin opens/reuses a tab.
- Session tabs persist in localStorage. Pins persist server-side (node:sqlite behind Start server functions — the same API runs on Bun and Node, so the pin store is unit-testable).
- Detail view: name, version(s), license, links (homepage / repo / docs / issues), rendered readme. Cards show downloads/license only where the registry search payload includes them.

### Registries (all accessed via Start server functions — one proxy path)

Identifying User-Agent set once; upstream caching respected; rate queues where required.

- npm: /-/v1/search (score + downloads in hits). Readme: registry doc, unpkg tarball README.md fallback when the registry readme is empty (~1/3 of popular packages).
- crates.io: /api/v1/crates?q=; max 1 req/s queue; readme = docs.rs pre-rendered HTML, sanitized (never markdown-rendered); license is detail-only.
- nixpkgs: search.nixos.org Elasticsearch backend (undocumented; creds from their public frontend bundle, held in SERVER_ env via src/env.ts). Packages only. Channel switcher, unstable default, channel in the query key. Runtime-pinned schema version, aggressive caching, graceful "nix unavailable" degradation.

### Readme rendering

@tanstack/markdown with allowHtml + sanitization + urlTransform (bake-off: 15/15 popular readmes acceptable; default escaping degrades ~70%). Sanitization runs server-side in the proxy.

### Quality

- Registry mapping is covered by unit tests against recorded upstream payloads; live contract checks (404/429, schema drift) run on demand and never in CI.
- The app has an end-to-end smoke test running against the real dev server.

## Success criteria

- Exact-name to package view in <= 2 keystrokes + Enter.
- Cold search to visible results per registry <= ~300ms beyond network.
- Tab/pin restore on reload; pins survive server restarts.
