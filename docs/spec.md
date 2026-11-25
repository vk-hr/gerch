# gerch spec

gerch is one fast, keyboard-first search across package registries. It keeps
open results in tabs inside the app and caches what you search often.

Status: phase 0 draft, 2026-11-24. Open choices live in
[`decisions.md`](decisions.md).

## Scope

### MVP

- One search input. Prefixes pick a registry: `npm:zod`, `crate:serde`,
  `nix:ripgrep`. No prefix searches all three.
- Results stream in per registry. A slow or failing registry shows its own
  loading or error state and never blocks the others.
- Result card: name, registry, latest version, last release date, license,
  downloads where available, description, repository and homepage links, and a
  copy button for the install command.
- Tabs inside the app for packages and searches. Switch, close and reorder
  with the keyboard. Tabs persist across reloads.
- Workspaces: named groups of pinned packages, for example "portfolio deps".
- Shared server-side cache with a TTL that serves stale data while it
  refreshes. A client cache persists TanStack Query data, history and pins.
- Suggestions rank frequently searched entries first.
- Registries: npm, crates.io, nixpkgs packages.
- Theme: light or dark, following the system preference, through
  [`start-theme`](https://github.com/vk-hr/start-theme). It is applied before
  the first paint and follows a change of system theme live.

### Later

NixOS and Home Manager options, PyPI, Go modules, Docker Hub, side-by-side
compare, OpenSearch for the browser address bar, a manual theme switch (see
[Theme](#theme)).

### Non-goals

Accounts, sync between devices, scraping HTML pages.

## Architecture

```
browser                              Vercel (one TanStack Start deploy)
  Redact client renderer   <-SSR--     Start SSR (React DOM server)
  TanStack Router + Query  --API-->    server routes /api/*
  IndexedDB query persister            registry adapters ---> npm, crates.io
  localStorage: tabs, pins,            Vercel CDN: Cache-Control SWR (ISR)
    workspaces, history                         |
                                       Supabase Postgres: shared SWR cache,
                                         crates.io rate-limit slot, nix index
GitHub Actions (every 6 h)  --------->   nix index <--- packages.json.br
```

- App: TanStack Start on Vite 8, with file routes, `autoCodeSplitting`, SSR,
  and ISR through `Cache-Control` headers on Vercel's CDN. TanStack Query
  dehydrates into the SSR HTML through `@tanstack/react-router-ssr-query`.
- Renderer: Redact in the browser (`redact({ environments: ["client"] })`)
  and React DOM on the server. Setting `GERCH_RENDERER=react-dom` builds
  without Redact.
- Server routes: Start server routes under `/api/*`. They set the gerch
  User-Agent, enforce per-registry rate limits, and read and write the shared
  cache. Adapters live in `src/server/registries/` as plain modules with no
  Start imports, so they can move to a separate deploy later.
- Database: Supabase Postgres over the transaction pooler. It holds the SWR
  cache, a single-row slot that keeps crates.io at 1 req/s across every
  function instance, the nix index, and vitals samples.
- Nix ingest: a scheduled GitHub Actions workflow (16 GB runner) downloads the
  channel dump when its ETag changes and rebuilds the nix index in Postgres.
  Vercel functions only read the index.
- Shared: result types and the adapter contract in `src/shared/`.

### API

| Route                                          | Purpose                                                        |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `GET /api/search?registry=npm\|crate\|nix&q=…` | One registry's results, normalized                             |
| `GET /api/package/:registry/:name`             | One package, normalized, with license and links                |
| `GET /api/health`                              | Liveness, nix index release and age, failed cache refreshes    |
| `POST /api/vitals`                             | `web-vitals/attribution` samples by route template and release |

The client sends one request per registry, in parallel. Each response is its
own TanStack Query entry, so results arrive and cache independently.

### Normalized result

```ts
type Registry = "npm" | "crate" | "nix"
type PackageSummary = {
  registry: Registry
  name: string // nix: attribute path, e.g. "ripgrep"
  version: string
  releasedAt: string | null // ISO 8601; null for nix
  license: string | null // SPDX expression when known
  downloads: { count: number; window: "week" | "90d" } | null
  description: string | null
  repository: string | null
  homepage: string | null
  install: string // "npm i zod", "cargo add serde", "nix-shell -p ripgrep"
}
```

### Cache

Two layers, keyed by registry + normalized query or package name. The Vercel
CDN serves `/api/*` responses with `s-maxage` and `stale-while-revalidate`
set to the fresh and stale windows below. Behind it, Supabase Postgres holds
the shared cache with the same windows:

| Kind              | Fresh for               | Serve stale up to | Notes                                  |
| ----------------- | ----------------------- | ----------------- | -------------------------------------- |
| npm search        | 10 min                  | 7 days            | single-flight refresh per key          |
| npm package       | 1 h                     | 30 days           |                                        |
| crates.io search  | 10 min                  | 7 days            | refresh goes through the 1 req/s queue |
| crates.io package | 6 h                     | 30 days           | supplies license for cards             |
| nix index         | until dump ETag changes | until next ingest | ETag checked every 6 h                 |

A stale hit returns at once with `X-Gerch-Cache: stale` and starts one
background refresh. A cold miss waits for upstream. Upstream errors on a stale
key keep serving stale data and report the error in `/api/health`.

Package pages (`/p/$registry/$name`) render on the server and send
`Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`. Search
pages render the shell on the server and fetch results per registry.

Client: TanStack Query cache persisted to IndexedDB. Tabs, workspaces, pins
and search history live in `localStorage`. The server can't read them, so the
tab strip renders on the client into a reserved-height slot (no layout shift),
and the server renders the active tab's route from the URL.

### Theme

`ThemeProvider` from `start-theme` wraps the app in the root route with the
theme fixed to `system`. Its inline bootstrap script resolves
`prefers-color-scheme` and sets `dark` or `light` on `<html>`, plus
`color-scheme`, before the first paint. The provider then follows changes of
the system theme. The styles use shadcn's `.dark` tokens.

The server renders the same HTML for every visitor, because Vercel's CDN
caches HTML without looking at cookies. A manual switch would keep the choice
in a cookie that the server reads. A cached page would then carry one
visitor's theme to everyone, and `Vary: Cookie` makes Vercel skip the cache
altogether. So the switch waits until the bootstrap script can read the
cookie in the browser (D29).

### Suggestions

The client keeps a history of `{query, registry, count, lastUsed}` entries.
It ranks them by frecency: `count` weighted by recency with a 7-day half-life.
Pinned packages that match the typed prefix come first, then history, then
live results.

## User flows

1. **Cold search.** The user opens gerch, types `serde`, and sees three
   registry sections. npm results appear first and nix results come from the
   local index. crates.io results appear when its queued request returns.
2. **Prefixed search.** The user types `crate:serde`. Only the crates.io
   section runs. The prefix shows as a chip and Backspace on an empty query
   removes it.
3. **Cached search.** The user reloads and searches `serde` again. All
   sections render from the persisted client cache with no network wait, then
   revalidate in the background.
4. **Open in a tab.** The user selects a result and presses Shift+Enter. A
   package tab opens next to the current one, and the search tab keeps its
   query and selection.
5. **Copy install.** On a selected result, Alt+C copies `cargo add serde` and
   shows a short confirmation.
6. **Pin to workspace.** Alt+P opens a workspace picker for the selected
   package. The user picks "portfolio deps" or creates a workspace by name.
7. **Workspace view.** Alt+W lists workspaces. Opening one shows its pinned
   packages as cards with current versions from cache.
8. **Restore.** After a reload, tabs, their order, the active tab and
   workspaces come back as they were.
9. **Registry down.** One registry times out. Its section shows the error and
   a retry hint. The other sections render normally.

## Keyboard map

The app avoids shortcuts that browsers reserve (Ctrl+T, Ctrl+W, Ctrl+Tab,
Ctrl+1..9) and Alt+letters that open browser menus (F, E, V, S, B, T, H).
Single-key shortcuts only fire when focus is outside a text input. All
shortcuts are registered through `@tanstack/react-hotkeys` from one
definitions file, which also renders the `?` list.

| Keys                           | Where           | Action                                    |
| ------------------------------ | --------------- | ----------------------------------------- |
| `/` or `Ctrl+K`                | anywhere        | Focus the search input                    |
| `Esc`                          | search          | Clear the query; a second Esc blurs       |
| `↓` / `↑`, `Ctrl+N` / `Ctrl+P` | search, results | Move the selection                        |
| `Enter`                        | result          | Open in the current tab                   |
| `Shift+Enter`                  | result          | Open in a new tab next to the current one |
| `Alt+C`                        | result          | Copy the install command                  |
| `Alt+P`                        | result          | Pin to a workspace                        |
| `Alt+.` / `Alt+,`              | anywhere        | Next or previous tab                      |
| `Alt+Shift+.` / `Alt+Shift+,`  | anywhere        | Move the current tab right or left        |
| `Alt+X`                        | anywhere        | Close the current tab                     |
| `Alt+Shift+X`                  | anywhere        | Reopen the last closed tab                |
| `Alt+W`                        | anywhere        | Open the workspace switcher               |
| `?`                            | outside inputs  | Show the shortcut list                    |

## Data sources

All three are documented, unauthenticated, and send
`access-control-allow-origin: *`. The API calls them anyway, to set the
User-Agent and share one cache. Every request sends
`User-Agent: gerch/<version> (+https://github.com/vk-hr/gerch)`.

|                  | npm                                                                                                                                      | crates.io                                                                                          | nixpkgs                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Search endpoint  | `GET registry.npmjs.org/-/v1/search?text=&size=` (max 250)                                                                               | `GET crates.io/api/v1/crates?q=&per_page=`                                                         | `GET channels.nixos.org/nixos-unstable/packages.json.br` (302 to releases.nixos.org), searched locally |
| Package endpoint | `GET registry.npmjs.org/{name}` (abbreviated with `Accept: application/vnd.npm.install-v1+json`)                                         | `GET crates.io/api/v1/crates/{name}`                                                               | same dump                                                                                              |
| Auth             | none                                                                                                                                     | none; **403 without a User-Agent** (verified)                                                      | none                                                                                                   |
| Rate limit       | none published; we cap ourselves at 5 req/s and cache                                                                                    | **1 req/s**, identifying User-Agent required ([data access policy](https://crates.io/data-access)) | static CDN file; fetch only when the ETag changes, checked every 6 h                                   |
| CORS             | `*` (verified)                                                                                                                           | `*` (verified)                                                                                     | `*` (verified)                                                                                         |
| Response cache   | `cache-control: max-age=300`                                                                                                             | none sent                                                                                          | `etag`, `last-modified`                                                                                |
| Terms            | npm Open Source Terms and Acceptable Use; documented in [`npm/registry`](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md) | crates.io data access policy; the sparse index and db dump are unlimited alternatives              | NixOS channel artifact; nixpkgs is MIT                                                                 |
| Size             | ~1 KB per result                                                                                                                         | ~1 KB per result                                                                                   | 10.6 MB Brotli, 418 MB JSON, 152,276 packages (2026-11-21 dump)                                        |
| name             | `package.name`                                                                                                                           | `crates[].name`                                                                                    | attribute path (object key)                                                                            |
| version          | `package.version`                                                                                                                        | `crates[].max_stable_version`                                                                      | `version`                                                                                              |
| release date     | `package.date`                                                                                                                           | `crates[].updated_at`                                                                              | not available                                                                                          |
| license          | `package.license`                                                                                                                        | not in search; `versions[].license` from the package endpoint                                      | `meta.license` (`spdxId`, may be compound)                                                             |
| downloads        | `downloads.weekly`                                                                                                                       | `crates[].recent_downloads` (90 days)                                                              | not available                                                                                          |
| description      | `package.description`                                                                                                                    | `crates[].description`                                                                             | `meta.description`                                                                                     |
| repository       | `package.links.repository`                                                                                                               | `crates[].repository`                                                                              | not available                                                                                          |
| homepage         | `package.links.homepage`                                                                                                                 | `crates[].homepage`                                                                                | `meta.homepage`                                                                                        |
| install          | `npm i {name}`                                                                                                                           | `cargo add {name}`                                                                                 | `nix-shell -p {attr}`                                                                                  |

### Later sources, not verified in phase 0

PyPI and pkg.go.dev are reported to have no general search API, and Docker Hub
search terms are unchecked. I'll verify these when they are scoped.

## Testing

- Every adapter passes one shared contract test. It runs against real
  responses recorded once into `test/fixtures/<registry>/`.
- Unit tests make no network calls. A test preload makes `fetch` throw
  unless the test is in the live suite.
- `GERCH_LIVE=1 bun test test/live` runs one smoke test per registry.
- Playwright replays cold entry, warm navigation, and typing while filtering
  the largest recorded result set.
