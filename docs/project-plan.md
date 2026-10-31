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

- [x] src/server/registries/npm.ts — search, package doc, unpkg readme fallback; map to a common PackageRecord shape
- [x] src/server/registries/crates.ts — search (1 rps queue), crate detail, docs.rs readme (HTML pass-through flag)
- [x] src/server/registries/nix.ts — ES query builder (type: package, field weights as on the site), channel + runtime schema-version pin, hard cache, typed failure -> graceful degradation
- [x] shared cache helper: respects upstream Cache-Control, in-memory with TTL; single UA constant
- [x] verify against live APIs (the live suite), incl. 404/429 paths

## Phase 2 — search UI

- [x] registry tab strip + query box (active-tab-only fetching, debounce, per-registry query keys incl. channel for nix)
- [x] results list: virtualized infinite scroll, unified PackageCard (fields per availability)
- [x] exact-name detection -> navigate to /:registry/:name
- [x] hotkeys: Mod+K, Escape, arrows/Enter
- [x] empty / loading / error states per registry (nix degradation banner)

## Phase 3 — package route + detail

- [x] /:registry/:name route, typed registry param
- [x] detail assembly: meta, versions (lazy for crates), links block
- [x] deps: sanitizer (server-side), nothing else
- [x] readme pipeline: fetch (registry -> unpkg fallback / docs.rs HTML) -> server-side sanitize (+ urlTransform) -> @tanstack/markdown allowHtml render; cache per package+version

## Phase 4 — workspace: tabs & pins

- [x] session tabs in localStorage (TanStack Store), tab strip = sidebar section, reuse-on-open
- [x] pins: node:sqlite + server functions (list/add/remove); sidebar pins section first; pin toggle on detail
- [x] sidebar collapse (Mod+B), restore-on-load ordering

## Phase 5 — polish & hardening

- [x] channel switcher UI, nix channel persisted per session
- [x] keyboard pass: full Mod+K/arrow/Enter/Escape flow, focus rings
- [x] error boundaries per panel; retry/backoff on 429
- [x] CI green (checks + e2e); dev smoke: SSR page, search all three registries, pin across restart

## Phase 6 — registry correctness and failure isolation

Goal: make search and detail data trustworthy before enriching the UI. No false empty results, no secondary fetch blanking a valid page, and no silent schema-drift caching.

- [x] nix mapper: tolerate nullable upstream fields (including `spdxId: null`), parse per hit so valid records survive partial drift, mark dropped-hit responses degraded, and never cache schema-failure outcomes.
- [x] realistic nix fixtures: add nullable-license and partial-drift payloads; regression tests prove valid hits survive and degradation/cache behavior is intentional.
- [x] failure taxonomy: keep genuine not-found, upstream outage, and schema drift distinct in server handlers and route loaders. A missing package must not become an empty fallback record.
- [x] independent detail fallbacks: npm registry metadata survives unpkg failure; crates metadata survives docs.rs failure. Readme failure produces a readme-unavailable result, not a route error.
- [x] crates readme correctness: rebase relative links/images against the docs.rs source before sanitization.
- [x] channel-correct nix detail: validate optional `?channel=`, use the saved channel as fallback, include channel in loader/query keys, and do not silently substitute unstable.
- [x] verification: unit suite plus on-demand live checks. `ripgrep` is the control; `firefox`, `hello`, `vim`, `docker`, and `linux` must map upstream hits to results instead of false empty searches.

Acceptance:

- [x] Nullable-license and partial-drift fixtures pass, including degradation and cache assertions.
- [x] docs.rs/unpkg failure tests prove metadata remains available.
- [x] Invalid channel, missing package, and outage paths produce distinct outcomes.
- [x] Production build and all routine checks remain green; live suite remains out of CI.

## Phase 7 — package-detail information architecture and presentation

Goal: make every package page a useful reference with deliberate sparse and failure states, without adding a new nix backend or changing the search interaction model.

- [ ] shared page hierarchy: identity/actions → installation → metadata/links → collapsible versions → readme. Registry-specific sections appear only where they add value.
- [ ] copyable installation snippets: `npm install <name>`, `cargo add <name>`, and `nix profile install nixpkgs#<full-attribute-path>`. Never derive nix commands from `pname` or fabricate missing identifiers.
- [ ] metadata completeness: preserve all nixpkgs homepage/license values; show the selected channel on nix detail; keep downloads only where the registry supplies them.
- [ ] version presentation: collapsed by default, current/latest marked, bounded scrollable list on expansion; no version analytics.
- [ ] deliberate route states: pending skeleton, intentional sparse layout, not-found with a path back to search, retryable outage alert, and readme-unavailable note alongside intact metadata.
- [ ] readme typography: readable headings, lists, tables, links, images, and code blocks in light/dark themes; responsive wide content without page-level horizontal overflow. Keep the existing server-side sanitizer and @tanstack/markdown pipeline.
- [ ] e2e coverage: channel-aware nix deep links, sparse package pages, readme-unavailable states, and secondary-failure preservation.
- [ ] final verification: lint, format, typecheck, unit, e2e, and production build.

Acceptance:

- [ ] Every registry detail follows the same hierarchy and offers a correct installation command when its identifier is available.
- [ ] A channel-specific nix deep link renders the same package on reload and does not silently change channels.
- [ ] A missing readme never results in a blank page; a missing package never looks like an outage.
- [ ] Readme content is readable in both themes and wide tables/code/images do not overflow the page.
- [ ] `docs/prd.md` success criteria are demonstrably covered by unit/e2e checks or documented on-demand live verification.

## Risks

- nixos-search schema version bump breaks queries (mitigation: runtime pin + tolerant per-hit mapping + visible degradation; never cache schema-failure outcomes).
- crates.io 1 rps under fast typing (mitigation: queue + debounce + cache; per-registry active-tab fetching keeps QPS ~trivial).
- unpkg availability for readme fallback (mitigation: cache on first success; show meta without readme on failure).
- npm @playwright/test must stay pinned to 1.64.1 to match the chromium revision in nixpkgs (mitigation: bump the npm package and the nixpkgs lock together).
- the v8 coverage provider is silently inert under Bun (mitigation: @vitest/coverage-istanbul).
- recorded fixtures drift from upstream responses (mitigation: re-record with `fixtures:record` and rely on the live suite for drift).
- the e2e dev server needs port 3100 free (mitigation: `--strictPort` fails loudly instead of shifting ports).
