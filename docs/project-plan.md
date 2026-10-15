# gerch — project plan

Stack (already in place): TanStack Start + Vite + bun, TanStack Query / Store / Virtual / Hotkeys / Form / Markdown / devtools, React Compiler (oxc), Tailwind 4 + Base UI components, t3-env, oxlint/oxfmt.

## Phase 0 — foundations

- [ ] env: SERVER_ vars for nix ES creds + UA contact; extend src/env.ts
- [ ] deps: sanitizer (server-side), nothing else
- [ ] data dir (gitignored .data/) + bun:sqlite helper module

## Phase 1 — registry layer (server functions)

- [ ] src/server/registries/npm.ts — search, package doc, unpkg readme fallback; map to a common PackageRecord shape
- [ ] src/server/registries/crates.ts — search (1 rps queue), crate detail, docs.rs readme (HTML pass-through flag)
- [ ] src/server/registries/nix.ts — ES query builder (type: package, field weights as on the site), channel + runtime schema-version pin, hard cache, typed failure -> graceful degradation
- [ ] shared cache helper: respects upstream Cache-Control, in-memory with TTL; single UA constant
- [ ] verify against live APIs (curl + unit-ish runs), incl. 404/429 paths

## Phase 2 — search UI

- [ ] registry tab strip + query box (active-tab-only fetching, debounce, per-registry query keys incl. channel for nix)
- [ ] results list: virtualized infinite scroll, unified PackageCard (fields per availability)
- [ ] exact-name detection -> navigate to /:registry/:name
- [ ] hotkeys: Mod+K, Escape, arrows/Enter
- [ ] empty / loading / error states per registry (nix degradation banner)

## Phase 3 — package route + detail

- [ ] /:registry/:name route, typed registry param
- [ ] detail assembly: meta, versions (lazy for crates), links block
- [ ] readme pipeline: fetch (registry -> unpkg fallback / docs.rs HTML) -> server-side sanitize (+ urlTransform) -> @tanstack/markdown allowHtml render; cache per package+version

## Phase 4 — workspace: tabs & pins

- [ ] session tabs in localStorage (TanStack Store), tab strip = sidebar section, reuse-on-open
- [ ] pins: bun:sqlite + server functions (list/add/remove); sidebar pins section first; pin toggle on detail
- [ ] sidebar collapse (Mod+B), restore-on-load ordering

## Phase 5 — polish & hardening

- [ ] channel switcher UI, nix channel persisted per session
- [ ] keyboard pass: full Mod+K/arrow/Enter/Escape flow, focus rings
- [ ] error boundaries per panel; retry/backoff on 429
- [ ] bun run check / typecheck clean; dev smoke: SSR page, search all three registries, pin across restart

## Risks

- nixos-search schema version bump breaks queries (mitigation: runtime pin + degradation).
- crates.io 1 rps under fast typing (mitigation: queue + debounce + cache; per-registry active-tab fetching keeps QPS ~trivial).
- unpkg availability for readme fallback (mitigation: cache on first success; show meta without readme on failure).
