# gerch — project plan

Stack (already in place): TanStack Start + Vite + bun, TanStack Query / Store / Virtual / Hotkeys / Form / Markdown / devtools, React Compiler (oxc), Tailwind 4 + Base UI components, t3-env, oxlint/oxfmt. Testing: Vitest 5 (unit + live projects), Playwright (chromium e2e), recorded upstream fixtures, CI (checks + e2e), nix dev shell (flake.nix + direnv).

## Test harness

Three suites, split by what they are allowed to touch.

| suite  | runner                      | runtime | scope                                                                                      |
| ------ | --------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `unit` | Vitest 5 (`--project=unit`) | Bun     | hermetic, no network: registry mapping, cache, rate queue, sanitiser (empty until Phase 1) |
| `live` | Vitest 5 (`--project=live`) | Bun     | opt-in, hits the real registries: 404/429, schema drift, rate limits                       |
| `e2e`  | Playwright (chromium)       | Node    | the real app: SSR, keyboard flow, tabs and pins                                            |

Commands:

- `bun run test` / `bun run test:watch` — unit suite only; empty until Phase 1, so it runs with `--passWithNoTests` for now.
- `bun run test:live` — live suite; needs the `SERVER_` credentials, never runs in CI.
- `bun run test:e2e` — Playwright; starts the dev server on port 3100 (3000 is taken by other local projects).
- `bun run fixtures:record` — re-records raw upstream payloads into `src/server/registries/__tests__/fixtures/`; review the diff before committing.

Conventions:

- Unit and live tests live in `src/**/__tests__/`, e2e specs in `e2e/`.
- Live files are named `*.live.test.ts` and are excluded from the unit run.
- Server functions are tested through their inner handler (`export const handler = async () => {}` plus `createServerFn().handler(handler)`); the RPC surface is covered by e2e.
- Hermetic tests need no credentials (the unit setup disables env validation); the live suite keeps validation on, so a missing credential fails loudly instead of degrading silently.
- The pin store is tested against an in-memory SQLite database, so no file or running server is needed.

CI (`.github/workflows/ci.yml`): a `checks` job (lint, typecheck, unit) and an `e2e` job (build, Playwright install, e2e), both on push to `main` and on pull requests. The live suite is not part of CI.

Dev environment: `flake.nix` + `.envrc` (direnv) provide bun, nodejs, and the Playwright chromium build from nixpkgs; `nix develop` also works without direnv. The shell points `PLAYWRIGHT_BROWSERS_PATH` at that build and sets `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`, because the nix store is read-only. `bun install` still fetches the JS dependencies.

Why these tools:

- Vitest runs on Bun (`bun --bun vitest`), so the v8 coverage provider is unusable there — it reports no data at all. Coverage therefore uses `@vitest/coverage-istanbul`, deferred until after Phase 5.
- The pin store uses `node:sqlite` rather than `bun:sqlite`: the API is identical on Bun and Node, so one module runs in the app and under the test runner.
- Two Vitest projects instead of a CLI include filter: Vitest 5 has no `--include` flag, and separate projects give the two suites independent setup files.
- Playwright runs with `channel: "chromium"`: the nixpkgs browser build ships no headless shell, which is what Playwright's default headless mode looks for.
- `@playwright/test` is pinned to 1.64.1 to match the chromium revision in nixpkgs.

## Phase 0 — foundations

- [x] env: SERVER_ vars for nix ES creds + UA contact; extend src/env.ts (the UA constant is shared with the fixture recorder)
- [x] data dir (gitignored .data/) + node:sqlite helper module

## Phase 1 — registry layer (server functions)

- [ ] src/server/registries/npm.ts — search, package doc, unpkg readme fallback; map to a common PackageRecord shape
- [ ] src/server/registries/crates.ts — search (1 rps queue), crate detail, docs.rs readme (HTML pass-through flag)
- [ ] src/server/registries/nix.ts — ES query builder (type: package, field weights as on the site), channel + runtime schema-version pin, hard cache, typed failure -> graceful degradation
- [ ] shared cache helper: respects upstream Cache-Control, in-memory with TTL; single UA constant
- [ ] verify against live APIs (the live suite), incl. 404/429 paths

## Phase 2 — search UI

- [ ] registry tab strip + query box (active-tab-only fetching, debounce, per-registry query keys incl. channel for nix)
- [ ] results list: virtualized infinite scroll, unified PackageCard (fields per availability)
- [ ] exact-name detection -> navigate to /:registry/:name
- [ ] hotkeys: Mod+K, Escape, arrows/Enter
- [ ] empty / loading / error states per registry (nix degradation banner)

## Phase 3 — package route + detail

- [ ] /:registry/:name route, typed registry param
- [ ] detail assembly: meta, versions (lazy for crates), links block
- [ ] deps: sanitizer (server-side), nothing else
- [ ] readme pipeline: fetch (registry -> unpkg fallback / docs.rs HTML) -> server-side sanitize (+ urlTransform) -> @tanstack/markdown allowHtml render; cache per package+version

## Phase 4 — workspace: tabs & pins

- [ ] session tabs in localStorage (TanStack Store), tab strip = sidebar section, reuse-on-open
- [ ] pins: node:sqlite + server functions (list/add/remove); sidebar pins section first; pin toggle on detail
- [ ] sidebar collapse (Mod+B), restore-on-load ordering

## Phase 5 — polish & hardening

- [ ] channel switcher UI, nix channel persisted per session
- [ ] keyboard pass: full Mod+K/arrow/Enter/Escape flow, focus rings
- [ ] error boundaries per panel; retry/backoff on 429
- [ ] CI green (checks + e2e); dev smoke: SSR page, search all three registries, pin across restart

## Risks

- nixos-search schema version bump breaks queries (mitigation: runtime pin + degradation).
- crates.io 1 rps under fast typing (mitigation: queue + debounce + cache; per-registry active-tab fetching keeps QPS ~trivial).
- unpkg availability for readme fallback (mitigation: cache on first success; show meta without readme on failure).
- npm @playwright/test must stay pinned to 1.64.1 to match the chromium revision in nixpkgs (mitigation: bump the npm package and the nixpkgs lock together).
- the v8 coverage provider is silently inert under Bun (mitigation: @vitest/coverage-istanbul).
- recorded fixtures drift from upstream responses (mitigation: re-record with `fixtures:record` and rely on the live suite for drift).
- the e2e dev server needs port 3100 free (mitigation: `--strictPort` fails loudly instead of shifting ports).
