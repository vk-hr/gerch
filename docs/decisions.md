# Decisions

Each entry gives the conflict or open choice, the recommendation, and why.
Status is **approved**, **proposed** (waiting for approval), or **needs you**
(an account, money, or a choice only you can make).

Facts marked "verified" were checked on 2026-11-24 against the npm registry,
the live APIs, or the tool itself.

## Versions

### D1. TanStack Query 5.108.5 does not exist: approved

`@tanstack/react-query@5.108.5` returns 404. `latest` is `5.108.4` for both
`@tanstack/react-query` and `@tanstack/query-core`. Pin `5.108.4`.

### D2. Exact pins: approved; step 1 pins the existing dependencies

Every named version exists (verified): `vite@8.3.8`, `react@19.3.1`,
`react-dom@19.3.1`, `babel-plugin-react-compiler@1.0.0`,
`typescript@7.0.2`, `@tanstack/react-router@1.170.46`,
`@tanstack/router-plugin@1.169.0`, `@tanstack/redact@0.3.1`,
`bun@1.4.5-canary.20261124.1`.

The directive does not name these versions, so I'll pin the current ones:

| Package                            | Pin               | Why                                                                         |
| ---------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| `react-doctor`                     | `0.9.23`          | latest; has `scan <url> --trace-out` (verified in the tarball)              |
| `@vitejs/plugin-react`             | `6.3.0`           | latest; exports `reactCompilerPreset` (verified)                            |
| `@rolldown/plugin-babel`           | `0.3.1`           | Redact peer range `^0.1.7 \|\| ^0.2.0 \|\| ^0.3.0`                          |
| `oxc-transform-react`              | newest `0.156.x`  | Redact needs `>=0.152.0 <0.157.0`; `latest` is `0.158.0`, out of range      |
| `@playwright/test`                 | `1.64.1`          | matches nixpkgs `playwright-driver` 1.64.1, so local browsers come from Nix |
| `tailwindcss`, `@tailwindcss/vite` | `4.3.5`           | latest 4.x                                                                  |
| `web-vitals`                       | `6.2.3`           | latest                                                                      |
| `@base-ui/react`, `shadcn`         | `1.9.0`, `4.23.0` | already installed                                                           |

All other `latest` and `^` ranges become exact versions.

## Toolchain

### D3. Bun canary pin: implemented in step 1

The pinned npm package `bun@1.4.5-canary.20261124.1` prints
`bun --version` = `1.4.6` and `bun --revision` = `1.4.6-canary.1+bd92f9bef`
(verified). Stable 1.4.6 will also print `1.4.6`, so the version gate compares
`--revision`.

`setup-bun` can't pin this build. Its `bun-version` takes release versions or
the moving `canary` tag, and `bun-download-url` expects a `.zip`, while the
immutable canary builds ship as npm `.tgz` packages.

Mechanism:

1. `package.json` lists `"bun": "1.4.5-canary.20261124.1"` as an exact
   devDependency. `bun.lock` records the sha512 of each
   `@oven/bun-<platform>` tarball.
2. **Local and hk hooks.** `flake.nix` builds `bun` from the same npm
   tarballs and sha512 hashes, patched with `autoPatchelfHook` so it runs on
   NixOS without nix-ld. The dev shell puts it on `PATH` ahead of the global
   stable 1.4.5.
3. **CI (step 2).** On a `node_modules` cache hit, `node_modules/.bin/bun` is
   already the canary. On a miss, a composite action downloads the tarball
   and checks it against the `bun.lock` integrity before running `bun ci`.
   The devDependency adds 157 MB to `node_modules` (264 MB → 401 MB), and in
   exchange CI needs no separate Bun cache.
4. **Gate.** `scripts/check-bun.ts` fails unless `bun --revision` equals
   `1.4.6-canary.1+bd92f9bef`. It runs in pre-commit, in `bun run verify`
   (pre-push, and CI in step 2). Measured: stable 1.4.5 exits 1, the canary
   exits 0.
5. **Drift.** `test/toolchain.test.ts` fails if `package.json`, `flake.nix`,
   `bun.lock` and `check-bun.ts` disagree on the version or any platform hash.
   Measured: one changed hash character fails it.

Rejected: bootstrapping with stable Bun and running `node_modules/.bin/bun`,
because `bun ci` would then run on stable 1.4.5.

### D4. Nix dev shell: approved

You added `.envrc` (`use flake`) and allowed it. Step 1 adds `flake.nix`.
The dev shell provides the Bun canary (D3), `hk` 2.13.0 and `pkl` 0.32.2.
Playwright browsers and Postgres join when the steps that need them land.
`.direnv/` is in `.gitignore`.

### D5. Lint and format: implemented in step 1

**Side by side (template code, same tree).** ESLint can't run on the template
at all: `typescript-eslint` throws "does not support TS 7.0". So the
comparison ran in a scratch copy with TypeScript 6.0.3.

|              | Old                      | New                                   | Findings     |
| ------------ | ------------------------ | ------------------------------------- | ------------ |
| Lint         | ESLint 10.15.0: 1,235 ms | `bun lint` on the same config: 218 ms | 0 and 0      |
| Format check | Prettier: 518 ms         | `bun fmt --check`: 62 ms              | same 2 files |

What `bun lint` misses with the template's config (`bun lint --doctor`): 62
rules run natively and 6 run in JavaScript. Four `import-x` rules have native
`import/*` equivalents. `n/prefer-node-protocol` maps to
`unicorn/prefer-node-protocol`. `@stylistic/spaced-comment` has no native rule,
so it stays as a JS plugin (`@stylistic/eslint-plugin` 6.0.1) and is verified
to fire.

What `bun fmt` misses: Prettier rewrites CSS string quotes to double quotes,
and `bun fmt` leaves them as written (two lines in `src/styles.css`). Tailwind
class sorting matches Prettier exactly, including theme classes inside `cn()`
and `cva()`. That only works through `.prettierrc`: `bunfig.toml` rejects
`tailwindStylesheet`, and without the stylesheet, theme classes sort wrongly.
So `.prettierrc` stays as `bun fmt`'s config. Neither `prettier` nor
`prettier-plugin-tailwindcss` needs to be installed (verified in a tree
without them).

**Lint config.** `.oxlintrc.json` turns on every category (`correctness`,
`suspicious`, `pedantic`, `perf`, `style`, `restriction`), carries all 68
template rules, and runs type-aware rules (`typeAware = true` in
`bunfig.toml`, so plain `bun lint` includes them; without it they are
skipped silently, measured). The first run flagged 99
problems on template code. Code was fixed where the finding was real.
Rules were turned off only for these reasons:

| Reason                                 | Rules off                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bans a language feature the stack uses | `unicorn/no-null` (the API's JSON contract uses `null`), `eslint/no-undefined`, `oxc/no-async-await`, `oxc/no-optional-chaining`, `oxc/no-rest-spread-properties`, `eslint/no-ternary`                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Contradicts another enabled rule       | `unicorn/no-array-reduce` (vs `eslint/no-await-in-loop`: no allowed way to run async steps in order); `typescript/require-await` (same as `eslint/require-await`); `vitest/no-hooks` (vs `vitest/require-hook`); `vitest/prefer-called-times` (vs `vitest/prefer-called-once`); `vitest/prefer-describe-function-title` (vs `vitest/valid-title` and the `bun:test` types); `import/no-named-export` and `import/prefer-default-export` (vs `import/no-default-export`); `import/exports-last` and `import/group-exports` (vs the file-route layout); `eslint/require-await` (vs `typescript/promise-function-async` and `typescript/return-await`) |
| Contradicts a directive                | `vitest/no-importing-vitest-globals` (test files keep their `vitest` imports); `vitest/require-test-timeout` (no per-test timeouts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Doesn't fit the stack                  | `react/react-in-jsx-scope` (automatic JSX runtime); `react/forbid-component-props` (Tailwind `className`); `react/jsx-no-literals` (no i18n); `typescript/explicit-function-return-type`, `typescript/explicit-module-boundary-types` (Router and Query rely on inferred types); `typescript/prefer-readonly-parameter-types` (library prop types aren't deep-readonly); `unicorn/text-encoding-identifier-case` (HTML `charSet` must be `utf-8`)                                                                                                                                                                                                   |
| React Compiler does it (D10)           | `react-perf/jsx-no-new-function-as-prop`, `jsx-no-new-object-as-prop`, `jsx-no-new-array-as-prop`, `jsx-no-jsx-as-prop` (they ask for hand-written `useCallback` and `useMemo` on every prop; the directive's React Compiler memoizes them, and step 7 adds it)                                                                                                                                                                                                                                                                                                                                                                                     |
| Template had it off                    | `eslint/sort-keys`, `eslint/sort-imports`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Configured rather than turned off: `no-console` (allows `console.error` and
`console.warn` for Vercel logs), `func-style` (declarations, arrows
allowed), `one-var` (`never`), `no-use-before-define` (hoisted functions
allowed), `no-magic-numbers` (ignores -1, 0, 1), `jsx-max-depth` (5),
`jsx-filename-extension` (`.tsx`), `capitalized-comments` (consecutive lines
allowed), `no-duplicate-imports` (separate `import type` allowed),
`vitest/consistent-test-it` (`test`), `id-length` (allows `q`, the search URL parameter), `no-void` (allowed as a statement: the way `no-floating-promises` accepts a promise an event handler starts and doesn't wait for), `only-throw-error` (allows the router's `NotFoundError`: a loader throws `notFound()`, a plain object, to get a 404). Scoped overrides: `scripts/**`
(console, `process.exit`, sync calls, top-level await, `process.env`), `*.config.ts`
(default export), `src/components/ui/**` (shadcn prop spreading and variant
exports), `src/routes/**` (`only-export-components`; the Start plugin handles
route HMR), tests (magic numbers, parent imports, function length and statement count,
`no-confusing-void-expression`, which `bun:test`'s `void`-typed `.resolves`
matchers trip); the vitest plugin runs on test files only, `test/fixtures/**`
(`require-hook`), `*.d.ts` (`import/unambiguous`), `src/server/env.ts` (the one place that
reads `process.env`), `playwright.config.ts` (reads `CI` to pick the browser), `test/setup/**` (the preload reads `GERCH_LIVE`), `src/components/suggestions/suggestion-list.tsx`
(`jsx-a11y/prefer-tag-over-role`: the combobox popup needs `role="listbox"`
and `role="option"` on custom elements, because `select` and `datalist`
can't hold styled options that `aria-activedescendant` points at; D27).

`typescript/ban-ts-comment` bans `@ts-expect-error`, `@ts-ignore` and
`@ts-nocheck` outright (the template allowed `@ts-expect-error`).

Timings on this repo: `bun lint` (type-aware) 168 ms, `bun fmt --check`
69 ms, `bun check` 49 ms.

**Tests.** `bunfig.toml` has no key for isolation; the binary's config parser
lists `randomize`, `restoreMocks`, `clearMocks`, `unstubEnvs` and
`unstubGlobals` but not `isolate`, and unknown keys are ignored silently. So
`bun test --isolate=modules` is always passed as a flag, and
`test/isolation/` fails without it (measured: 1 fail without the flag, pass
with it). `test/vitest.d.ts` maps `vitest` imports to `bun:test` types, which
is what Bun does at runtime; a bad import from `vitest` still fails `bun
check`. `tsconfig.json` sets `moduleDetection: "force"` so Bun scripts with
top-level await typecheck as modules.

### D6. Template cleanup: implemented in step 1

Deleted `.cta.json` (scaffolder metadata, the only pnpm reference),
`.prettierignore` (lists npm, yarn and pnpm lockfiles), `.npmrc`
(`legacy-peer-deps` is an npm setting), `eslint.config.js`, and unused
`src/logo.svg`. Removed ESLint, Prettier, the Prettier Tailwind plugin, the
TanStack devtools packages and `@types/node`; added `@types/bun`. `.prettierrc`
stays as `bun fmt`'s config (D5). No non-bun lockfile existed. Renamed the PWA
manifest entries.

Also removed `@tanstack/router-cli`, its `generate-routes` script and
`tsr.config.json`. Its output drops Start's `Register` block, so it is wrong
for a Start app. The Start plugin generates `src/routeTree.gen.ts` with
`quoteStyle: "double"` and `semicolons: false`, so a build leaves the file
byte-identical and `bun fmt --check` passes after a build. Tailwind's
automatic source detection also scanned `docs/` and `scripts/`, so
`src/styles.css` now sets `source(".")`.

TanStack Start stays (D10). Router and Query devtools can come back later
behind a dev-only lazy import, if needed.

### D7. Conventional commits: approved

- hk 2.13.0 has `Builtins.check_conventional_commit` and
  `hk util check-conventional-commit` (verified). The `commit-msg` hook uses
  the builtin.
- The CI small-checks job runs the same check on the PR title and on every
  commit in the PR.
- Merge by squash, so the PR title becomes the commit on main.
- Add `Builtins.no_commit_to_branch` for `main`, so work always happens on a
  branch.

## CI

### D8. Merge queue and runners on a personal account

Neither works on `vk-hr/gerch`, which is a public repo owned by a user account
(verified with `gh`):

- GitHub merge queue is "available in any public repository owned by an
  organization, or in private repositories owned by organizations using
  GitHub Enterprise Cloud" (GitHub docs).
- Blacksmith "is limited to GitHub organizations and not available for
  personal repositories" (Blacksmith quickstart).

#### Runners: GitHub-hosted, Blacksmith skipped: approved

Decided 2026-11-24. Jobs run on `ubuntu-latest`. For public repos that is a
4 vCPU, 16 GB VM, free with no minute limit (GitHub runner reference). Cost:
$0/month.

Expected cost of skipping Blacksmith, per PR. The waiting and GitHub setup
numbers come from 135 GitHub-hosted Ubuntu jobs in the last 40 runs of
`vitejs/vite`, `TanStack/query` and `TanStack/router` (2026-11-24). The
Blacksmith numbers are its own claims, not measured here.

| Bucket           | GitHub-hosted (estimate)                                                                                                                   | Blacksmith (claimed)                                                             | Difference                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------- |
| Waiting          | p50 3 s, p90 35 s, p95 68 s (`vitejs/vite`, 70 jobs; 76% under 5 s)                                                                        | warm machines, aimed at under 5 s                                                | ≈0 s at p50, +30–65 s at p95             |
| Setup            | ~8–12 s: set up job 1 s and checkout 2 s (p50, measured), plus restoring ~340 MB of cache (79 MB Bun tarball, 264 MB `node_modules` today) | "4× faster cache downloads"                                                      | +3–6 s                                   |
| Running          | 4 vCPU                                                                                                                                     | 2× faster than GitHub's 2 vCPU _private_ runners; at equal 4 vCPU I assume ~1.2× | +3–5 s on the slowest job (`e2e`, ~20 s) |
| **PR wall time** | **p50 ≈ 33 s, p95 ≈ 75–110 s**                                                                                                             | p50 ≈ 24 s, p95 ≈ 35 s                                                           | **+~10 s at p50, +40–75 s at p95**       |

Against the directive: median under 1 minute and p95 under 2 minutes still fit
on these estimates. The 5 s waiting budget fails at roughly p75 and above. The
15 s setup budget holds at p50 and is tight at p95. Step 2 replaces these
estimates with numbers from real runs.

The TanStack repos queue far longer (`TanStack/router` p50 2,674 s). That
comes from account-wide concurrency limits and dependent jobs in large
monorepos, which a 4-job repo with no `needs:` doesn't hit, so it's left out
of the estimate.

#### Merge queue: skipped, ruleset instead: approved

Decided 2026-11-24. The repo stays on the personal account, with no
organization and no merge queue.

The closest equivalent is a ruleset on `main` (id `28017666`), applied
2026-11-24 after your approval:

- Require a PR, and allow squash merges only, so the PR title (checked for
  Conventional Commits) becomes the commit on `main`. PR #1 landed as a merge
  commit, "Merge pull request #1", which isn't a Conventional Commit.
- Require the status checks `checks`, `test` and `build`, with branches up to
  date before merging. `test` runs the full suite with no selection on every
  PR, and "up to date" means it ran on the exact tree that lands on `main`.
  `test-changed` (selection) is not required.
- `e2e` joined the required checks on 2026-11-25, at your request.
- Block force pushes and deletion of `main`.

### D9. Directive budgets on a new repo: implemented in step 2

- **Shape.** `.github/workflows/ci.yml` runs on PRs and on pushes to `main`.
  It has four parallel jobs and none uses `needs:`:
  - `checks`: pin, format, lint, typecheck, plus Conventional Commits on the
    PR title and every commit. The commits step runs even when the first step
    fails, so every failure is listed.
  - `test`: the full suite, with a JUnit report that proves every test file
    ran.
  - `test-changed` (PRs only): the selected tests.
  - `build`: the build, plus a check that the route tree is unchanged.
  - Byte budgets, Playwright and React Doctor join in step 7, as planned.
- **Budgets.** Every job ends with `scripts/ci-budget.ts`. It reads the job's
  `created_at` and `started_at` from the GitHub API and the end of setup from
  the setup action. It fails the job when setup exceeds 15 s or the job
  exceeds 35 s, and writes waiting, setup, running and job time to the job
  summary. Inside the jobs, `scripts/verify.ts` fails lint or format over
  1 s, typecheck over 5 s, and tests over 30 s.
- **Waiting budget: approved 2026-11-24.** GitHub's queue time isn't
  something our code controls, and without Blacksmith roughly a quarter of
  jobs will wait over 5 s (D8). Failing those jobs would turn CI red for
  reasons no commit can fix. So jobs fail on setup and running budgets only,
  and waiting is recorded against the 5 s target.
- **Setup.** "Bake the toolchain into the runner image" isn't possible on free
  GitHub-hosted runners. `.github/actions/setup` restores `node_modules`,
  which holds the pinned canary, keyed on `bun.lock`. On a miss it downloads
  the canary tarball, checks it against `bun.lock`'s sha512, and runs
  `bun ci`. Only pushes to `main` save the cache, so PR caches are seeded
  from `main`. Checkout is blobless (`filter: blob:none`). In-progress PR runs
  are cancelled when a new commit lands.
- **Selection.** `scripts/select-tests.ts` runs `bun test --changed=<base>`
  unless the diff touches a shared input. These rerun everything:
  `package.json`, `bun.lock`, `bunfig.toml`, `tsconfig.json`,
  `vite.config.ts`, `flake.nix`, `flake.lock`, `test/vitest.d.ts`,
  `scripts/select-tests.ts`, `test/fixtures/**` and `.github/**`. An empty
  diff runs nothing. The full `test` job still runs on every PR, so a change
  hidden from selection still turns CI red (demonstrated on a throwaway PR
  in step 2).
- **Shards.** One shard for now, because the suite takes under 0.1 s.
  `scripts/check-test-files.ts` already merges JUnit reports, so it proves
  coverage across shards once they exist. Timings (`--timings`,
  `--update-timings` on `main`) come with the second shard.
- **Step 5 growth (2026-11-25).** PR #11 went over two budgets with every
  test passing: lint took 1,112 ms (budget 1 s) and the e2e job 48 s
  (budget 35 s, 57 flows on one runner).
  - Lint: type-aware lint and `bun check` both type-check the project, and
    `verify.ts` ran them side by side on the runner's 4 cores. Lint now runs
    alone first, then the rest in parallel, still listing every failure.
    Pinned to 4 cores locally: about 500 ms beside typecheck, about 300 ms
    alone. CI lint ranged 500–1,112 ms across the step 5 branches.
  - E2E: "buy cores before shards" means paid larger runners, so the flows
    run as 4 Playwright shards on free runners (`--shard=i/4`). Shard 1
    keeps the job name `e2e`, the required check; the others are `e2e-2` to
    `e2e-4`. `scripts/check-e2e-shards.ts` proves in each shard job that
    the shards list every flow exactly once. The first CI run used 3 shards:
    jobs took 27.0–33.9 s, and the 33.9 s one had a 13.6 s setup, so a
    fourth shard leaves room for slow setups. Matrix jobs share one
    `GITHUB_JOB`, so `ci-budget.ts` reads the shard's name from
    `GERCH_JOB_NAME`.
  - Root cause of the slow e2e jobs (diagnostic traces, draft PR #12): each
    Playwright worker launches its own browser, and on a fresh runner four
    simultaneous launches of the runner's Google Chrome took 8–48 s, plus
    1.8–11.6 s to create the first page. The flows themselves take about
    1 s. Tests aren't slow; the browser start-up is, and it varies by runner.
    CI now uses Playwright's `chromium-headless-shell`, the default for
    headless Chromium without a `channel`, cached in `~/.cache/ms-playwright`
    per Playwright version (saved only from `main`). Locally the Nix shell's
    browsers are unchanged.
- **Later.** The 150-run audit runs once 150 runs exist. The test-failure log
  (`docs/test-failures.md`) starts with the first fixed test failure.

### D10. Rendering: TanStack Start with SSR: approved

Decided 2026-11-24. You want SSR and ISR, so TanStack Start stays. This
reverses project adjustment 1 and the performance directive's
"client-rendered React app". Everything else in the directive still applies:
the plugin order, load on intent, the byte budgets and the renderer
comparison.

- `vite.config.ts` registers, in order:
  `tanstackStart({ router: { autoCodeSplitting: true } })`, which wraps
  router-plugin 1.169.0 in place of a separate `tanstackRouter()`; then
  `tailwindcss()`, `react()`, Babel with `reactCompilerPreset()`, and
  `redact({ environments: ["client"] })`.
- Redact 0.3.1 has a `client`/`ssr` `environments` option and leaves `rsc`
  on real React (verified in its source). The directive calls Redact the
  browser renderer, so SSR uses React DOM. Whether Redact hydrates React DOM
  server HTML cleanly is unverified. Step 7 tests it, and if it fails, the
  directive's rule ships React DOM.
- `GERCH_RENDERER=react-dom` builds without `redact()`.
- The byte budgets count client JS and CSS only. SSR HTML is measured as
  LCP and time to usable content in the Playwright traces.
- Layout: `src/routes/` (pages and `/api/*` server routes),
  `src/server/registries/` (adapters with no Start imports), `src/shared/`
  (types, adapter contract, install commands).

### D11. Streaming per registry: approved

The client sends one request per registry instead of one server stream
(NDJSON or SSE). Each registry gets its own query key, cache entry, Suspense
boundary and error state. Over HTTP/2 the three requests share one
connection. This uses TanStack Query as designed and needs no stream parser.

### D12. nixpkgs source: approved

Use the published channel dump, not the search.nixos.org Elasticsearch
backend, which isn't a documented public API.

- A scheduled GitHub Actions workflow runs every 6 h and checks the dump's
  ETag. On a change it downloads the dump and loads attribute path, pname,
  version, description, license, homepage and `mainProgram` into a staging
  table with `COPY`. It then swaps the staging table in as the index in one
  transaction. Search uses a `tsvector` plus `pg_trgm` index for prefix and
  typo matches.
- Measured with the pinned canary: reading and parsing the 418 MB dump takes
  1.2 s and peaks at 1.5 GB RSS, and the slim rows are 25 MB. That's too
  heavy for a Vercel function but fine on a 16 GB Actions runner. The
  index's size in Postgres gets measured in step 6, against the 500 MB
  Supabase Free limit.
- The 6-hourly writes also count as activity, so the Free project isn't
  paused after a week without traffic.
- Channel: `nixos-unstable`, matching search.nixos.org's default. The dump
  has no per-package release date, downloads or repository, so cards show
  "—" and the channel's dump date.

### D13. crates.io license under 1 req/s: approved

Search results omit the license, which lives on each version. Fetching it per
result at 1 req/s would take ~10 s for a 10-result page.

**Recommendation:** render cards from search at once and fill in license
lazily. Package requests go through the same 1 req/s slot, in result order,
and are cached for 6 h. The slot is one Postgres row updated atomically, so
the limit holds across all Vercel function instances. Repeated searches then show license immediately.

Alternative: ingest the daily db dump (`static.crates.io/db-dump.tar.gz`) for
licenses, as with nix. That gives complete licenses offline but adds a second
ingest pipeline. I haven't checked the dump's size. I'd keep it for later.

### D14. Downloads differ by registry: approved

npm reports weekly downloads and crates.io reports 90-day `recent_downloads`.
Cards label the window ("/wk", "/90d") instead of converting between them.
nix has no download data, so the field is hidden there.

### D15. Client persistence: approved

- The TanStack Query cache persists to IndexedDB through
  `@tanstack/query-async-storage-persister` (async, no 5 MB `localStorage`
  limit). It restores after hydration, so SSR markup and the first client
  render match.
- Tabs, workspaces, pins and history go in `localStorage` under one
  versioned key. The server can't read them, so the tab strip renders on the
  client into a reserved-height slot (no layout shift), and the server renders
  the active route from the URL.

### D16. User-Agent: approved

Use `gerch/<version> (+https://github.com/vk-hr/gerch)`. crates.io asks for a
way to contact us, and the repo URL provides one without publishing an email
address.

### D17. Keyboard map and hotkeys library: approved

See [`spec.md`](spec.md#keyboard-map). It avoids browser-reserved shortcuts
(Ctrl+T/W/Tab/1..9) and Firefox's Alt+letter menus. Shortcuts use
`@tanstack/react-hotkeys` 0.27.2. It declares `react-dom >=18` as a peer, so
step 4 checks that it works under Redact's `react-dom` alias.

### D18. Field vitals: approved

`web-vitals/attribution` samples go to the gerch API (`POST /api/vitals`) and
are stored in Postgres by route template and release. This adds no third-party
analytics service.

### D19. Hosting: Vercel and Supabase: approved

Decided 2026-11-24. You set up both accounts.

- **Vercel Hobby, $0/month.** Hobby is limited to personal, non-commercial
  use. A portfolio project fits, but client work hosted on it would not.
  - Vercel's Bun runtime is in beta and accepts only `bunVersion: "1.4.x"`,
    with Vercel choosing the patch. Production therefore can't run the pinned
    canary. Server code must only use APIs that stable Bun 1.4 has; CI tests
    on the canary.
  - Settled in step 3: the `nitro()` Vite plugin (`nitro@3.0.261103-rc`)
    builds Start for Vercel, and `bunVersion: "1.4.x"` in `vercel.json`
    makes Nitro target Vercel's Bun 1.4 runtime. So the Postgres client is
    `Bun.SQL`, with `prepare: false` for the Supabase transaction pooler,
    wrapped by Drizzle (D22). `bun run dev`, `build` and `preview` run Vite with
    `bun --bun`, so dev and SSR also run on Bun.
- **Supabase Free, $0/month:** 500 MB database, shared CPU, 500 MB RAM,
  5 GB egress. It pauses after a week without activity (see D12). Pro is
  $25/month if the nix index or traffic outgrows Free.
- **Domain:** `gerch.vkhr.dev`.

### D20. Deploys: Vercel Git integration: approved

Decided 2026-11-24. Vercel deploys every push to `main` and builds a preview
for every PR through its Git integration. No Vercel secrets go into GitHub.

Consequence: Vercel installs and builds with its own Bun, not the pinned
canary. CI still runs every check on the canary, so what reaches `main` has
passed them. The build itself (`vite build`) uses no canary-only command.
Step 3 sets the Vercel install command to `bun ci`, so Vercel fails on a
stale lockfile instead of rewriting it.

Secrets, set by you:

| Secret                                                  | Where                 | For                    |
| ------------------------------------------------------- | --------------------- | ---------------------- |
| `DATABASE_URL` (Supabase transaction pooler, port 6543) | Vercel env            | server routes          |
| `DATABASE_URL` (Supabase session pooler or direct)      | GitHub Actions secret | nix ingest, migrations |

Neither is needed before step 3.

### D21. Database in tests: implemented in step 3

Unit and contract tests use PGlite (`@electric-sql/pglite` 0.6.0), an
in-process WASM Postgres, through `drizzle-orm/pglite`, with the real
`drizzle/` migrations applied, one instance per test file, emptied after
each test. One instance per test cost 0.6 s each (cache tests 3.8 s); one per
file brought them to 1.4 s. This matches the CI
directive's "each shard its own throwaway database" with no service
container and no setup time. Migrations run on PGlite in tests and on
Supabase in deploys. A later opt-in test can run the migrations against a real Postgres from the
Nix dev shell to catch PGlite gaps.

### D22. Drizzle ORM: implemented

Decided 2026-11-24, at your request.

- `drizzle-orm` and `drizzle-kit` pinned at `1.0.0-rc.6`, following Drizzle's
  agent setup prompt, which targets the rc series only.
- Agent tooling: the bundled Drizzle skill is copied into
  `.claude/skills/drizzle/` (hashed in `skills-lock.json`, excluded from
  `bun fmt`), and `.mcp.json` registers the Drizzle Kit MCP server as
  `bun run drizzle-kit mcp`. Kit's own `drizzle-kit skills` runs an interactive
  `bunx skills@latest add`, so the same installer ran directly instead:
  `bunx skills@1.9.0 add ./node_modules/drizzle-kit/skills -a claude-code -y
--copy`, with `DISABLE_TELEMETRY=1`.
- Schema in `src/server/db/schema.ts`; `drizzle.config.ts` at the root.
  Migrations are generated (`drizzle-kit generate`), reviewed and committed
  in `drizzle/`, and applied with `bun run migrate` (the Bun.SQL migrator).
  `push` is for local experiments only, never against Supabase, as the skill
  recommends for production.
- The hand-written `src/server/migrations.ts` is gone. Its one table,
  `cache_entries`, is now migration `20261124202437_cache_entries` with the
  same columns.
- `drizzle/` and `drizzle.config.ts` rerun every test, because tests read the
  migrations from disk, which `bun test --changed` can't see.

### D23. Arrow keys and streamed results: implemented in step 4

- Arrow keys move focus through result cards. They are list navigation, so
  their TanStack Hotkeys registrations target `<main>` and act only while
  focus is in the search box or a card. `/`, Mod+K, Escape and Alt+C listen
  on the document.
- A direct link streams each registry's results inside a Suspense boundary.
  React's streaming runtime (`$RC` in `react-dom/server`, React 19.3) parks a
  finished boundary in `<div hidden id="S:…">` and, once the page has painted,
  reveals it at most every 300 ms (`$RT + 300 - now`), so boundaries that
  finish close together appear in one batch. Measured with the replay
  fixtures: results in the DOM by 104 ms, revealed at 326–347 ms.
- During that window the skeleton is on screen and ArrowDown has nothing
  visible to focus, so it does nothing. That is the expected behavior, not a
  lost key. The end-to-end flow waits for the first card to be visible before
  pressing ArrowDown, as a user would. It first failed 5 of 5 by pressing
  right after hydration.
- Every search failure is data: the server function returns `{ ok: false }`,
  and a request that never reaches the server (offline, a deploy in
  progress) becomes the same result in the query function. So each section
  shows its own error and Retry without an error boundary, and a failure is
  stale at once, so revisiting it searches again.
- The search server function sets its CDN `Cache-Control` only on the
  browser's own call (Start sends `x-tsr-serverFn: true`). During SSR the
  loader calls it in-process, inside the page request, and crawlers get the
  page in one response after the searches finish, so the page used to carry
  whichever search finished last: `s-maxage=600` or `no-store`.
- Known gap: the search box isn't resynced when `q` changes from outside
  (back, forward, a link). Nothing can trigger it yet, because typing
  replaces the history entry and the page has no links to queries. Step 5
  adds such links, so it fixes this with a test. Fixed in step 5a (D25).

### D24. Client state for step 5: implemented

Decided 2026-11-25. At your request, step 5 runs as three PRs, built in
parallel by three agents in separate worktrees on top of this shared base:

- 5a (D25): the npm package page, tabs, and the back/forward resync of the
  search box.
- 5b (D26): workspaces and pins.
- 5c (D27): history, frecency suggestions, the IndexedDB query cache, the
  `?` shortcut list, Ctrl+N/Ctrl+P and the prefix chip.

The base holds what all three would otherwise each invent:

- `src/client/state.ts`: the saved state's types (`Tab`, `Workspace`,
  `Pin`, `HistoryEntry`, `ClientState`) and `parseState`, which keeps every
  valid entry of a saved value and drops the rest, so one bad entry never
  costs the user their tabs. No zod: the browser bundle stays small (D5).
- `src/client/store.ts`: one in-memory copy saved to `localStorage` under
  `gerch:v1`. A write that storage refuses still updates the page.
- `src/client/use-client-state.ts`: `useClientState(select)` through
  `useSyncExternalStore`. The server and the hydrating render see the empty
  state, so markup matches (D15). Other windows' changes arrive through the
  `storage` event.
- `src/hotkeys.ts`: every shortcut from the spec's keyboard map, so the parts
  register keys without editing the same lines.

### D25. Package page, tabs and the search box resync: implemented in step 5a

**npm package data ("option 1").**

- The adapter fetches `GET registry.npmjs.org/<name>/latest` (one version's
  manifest, ~4–6 KB) and `GET api.npmjs.org/downloads/point/last-week/<name>`
  in parallel. Names are URL-encoded; both hosts accept
  `%40trpc%2Ftanstack-react-query` (verified). The full package document is
  never fetched: 4.2 MB for zod, 7.2 MB for react.
- A 404 from `/latest` means no such package: `null`, cached like any value.
  A 404 from the downloads API means no count. Any other upstream error
  throws, so the SWR cache keeps serving stale data.
- The release date exists only in the full document, so the server returns
  `releasedAt: null`. The page borrows the date from a cached TanStack Query
  search result for the same package (`cachedReleaseDate`), read through
  `useSyncExternalStore` with a `null` server snapshot. SSR and hydration
  match, and the date appears once the client cache has it. A direct link
  shows no date.
- Cache key `package:<registry>:<name>`, fresh 1 h, stale up to 30 d. The
  server function's own browser call gets `public, max-age=0, s-maxage=3600,
stale-while-revalidate=2592000` for a found package and `no-store`
  otherwise, the same pattern as search (D23).
- `bun run record-fixtures npm package-` records only the package fixtures,
  so the search fixtures stay as they are.

**Package page `/p/$registry/$name`.**

- The loader awaits the package. An unknown registry or package throws
  `notFound()`, so the server answers 404. The page sends `public,
s-maxage=3600, stale-while-revalidate=86400` for a found package or a
  "coming soon" registry (crates.io, nixpkgs) and `no-store` for a failure,
  which shows its error and a Retry button.
- `$name` holds the whole name, so a scoped package lives at
  `/p/npm/%40trpc%2Ftanstack-react-query` (the router encodes the slash).

**Tabs.** The active tab always shows the current route.

- Tab actions (Enter, Shift+Enter, the Alt shortcuts, clicks and typing in
  the search box) save the change first, then navigate when the active tab's
  route changed. Switching and reopening push a history entry; closing
  replaces it.
- Routes the actions didn't start (back, forward, links) follow the route: a
  tab that already shows it becomes active, otherwise the active tab shows
  it. So Back after a tab switch activates the previous tab instead of
  overwriting the current one. On the first load an unmatched route opens a
  new tab instead, so a shared link never overwrites a saved tab, and a
  reload finds its active tab and changes nothing.
- Shift+Enter opens each package after the consecutive package tabs following
  the active tab. It leaves
  the search tab in front, with its query and focused card. Several results
  can be opened in a row, as with a middle click in a browser.
- Closing the active tab activates its right neighbour, or its left one at
  the end. Closing the last tab leaves an empty search tab. `closedTabs`
  keeps the last 20. Reopening inserts the tab after the active one, because
  the saved state has no original position. Next and previous wrap around;
  moving stops at the ends.
- Tab shortcuts pass `ignoreInputs: false`: TanStack Hotkeys' `'auto'`
  default skips Alt combos in text inputs, and these work anywhere.
- `Alt+Shift+.` and `Alt+Shift+,` fire as defined in `src/hotkeys.ts`. On a
  US layout the browser reports `>` and `<` with codes `Period` and `Comma`,
  and TanStack Hotkeys 0.27.2 falls back to the key's position for ASCII
  symbols typed with Shift (its matcher, and verified in Playwright).
- The strip renders from `useClientState`, so the server and the hydrating
  render show an empty `h-10` slot. A Playwright flow compares `<main>`'s top
  with JavaScript off and on: equal.
- The `body[data-interactive]` marker moved to
  `src/components/use-interactive-marker.ts`, used by the search and package
  pages. Setting it from the tab strip failed "typing a prefixed query" 1 of
  1: the strip sits outside the route's Suspense boundary, hydrates in an
  earlier commit, and marked the page before the search page's hotkeys
  existed.

**Search box resync (D23's known gap).** Typing writes `q` from the change
handler once typing pauses (150 ms), through the tab actions. The hook
remembers the last value it wrote, so a `q` that differs came from outside
(back, forward, a tab switch). It then replaces the text and cancels any
write still waiting. Before the fix, switching between two search tabs kept
the old text, and its debounced write replaced the new history entry. Two
flows cover it; they use Playwright's clock to fire any pending write on
purpose instead of waiting.

**Left open.**

- No shortcut or button opens an empty search tab; the keyboard map has
  none. A second search tab comes from a link, a reopened tab, or a package
  tab navigated back to search.
- `GET /api/package/:registry/:name` from the spec's API table isn't built;
  the page uses the server function.
- Bundle (Brotli 11, all client assets): JS 130,925 → 137,601 B, CSS 4,842 →
  5,008 B.

### D26. Workspaces and pins: implemented in step 5b

- **Where the view lives.** The pin picker (Alt+P) and the workspace view
  (Alt+W) are modal dialogs. `WorkspaceDialogs` is mounted once in
  `src/routes/__root.tsx`, so both keys work on every page. A workspace
  route would need 5a's tab integration (D24), and dialogs need no URL.
- **Load on intent.** Each dialog is a `React.lazy` chunk loaded on the
  first Alt+P or Alt+W. Only the hotkey registrations ship on cold entry.
  Brotli 11, measured on what `/` and `/?q=zod` request: JS 130,925 →
  132,843 B, CSS 4,842 → 5,699 B. The dialog chunks add 31,692 B on first
  use: 29,640 B shared, 652 B picker, 1,400 B view.
- **Base UI directly, not shadcn files.** shadcn's `dialog` and `combobox`
  put several components in one file, which `react/no-multi-comp`
  rejects. Its combobox is also a popover. Base UI's `Combobox` in
  `inline` mode is its documented pattern inside a `Dialog`. The
  components in `src/components/workspaces/` use base-luma's classes and
  tokens.
- **Accessibility.** Both dialogs use the ARIA combobox pattern: a labelled
  text box (`role="combobox"`) over a `listbox` of `option`s. Typing
  filters, the arrow keys move, Enter chooses, and Escape closes. The
  picker offers `Create "<name>"` when no workspace has the typed name
  exactly, ignoring case and spaces. Creating a name that exists reuses
  that workspace.
- **Pins.** A pin is the same package when both registry and name match.
  Pinning it again leaves the workspace unchanged, including the snapshot.
- **Freshest card.** A pin shows the newest cached search result for its
  package (by `dataUpdatedAt`) and falls back to the pin's snapshot. `Pin`
  has no pin time (D24), so a cached result whose `releasedAt` is older
  than the snapshot's loses to the snapshot. This matters once 5c restores
  old caches from IndexedDB.
- **Focus.** Closing a dialog returns focus to where it was when the first
  dialog opened, such as the pinned card. `WorkspaceDialogs` does this
  after the dialog unmounts, with `finalFocus={false}` on the popup. Base
  UI's own return doesn't run when the dialog unmounts on close; the
  end-to-end flows first failed 3 of 5 on it.
- **Lint.** `react(todo)` (React Compiler can't compile `??=`),
  `typescript/prefer-nullish-coalescing` and
  `eslint/logical-assignment-operators` together reject every
  "assign if null" form. The code keeps the return target in state through
  a pure updater instead. No rule changed.
- **Review fixes (lead).**
  - The picker lists an exact name first. Enter on "portfolio" used to pin
    into "portfolio deps".
  - A workspace that already holds the package is a disabled option
    instead of a silent no-op.
  - Page shortcuts skip focus inside a dialog (`focusInDialog()`): `/` and
    Mod+K no longer move focus behind the dialog, and Alt+P on a card in
    the workspace view no longer swaps the view for the picker.
  - One `CopiedProvider` at the root serves both the page and the dialogs,
    so Alt+C marks the card it copied from.
  - Result cards take their heading ids from `useId()`, so a card shown in
    the view and on the page no longer shares an id.
  - A boundary around the lazy dialogs shows an alert when their code fails
    to load. The search page used to be replaced by the root error screen.
  - `GERCH_E2E_PORT` sets the Playwright port, so worktrees can run the
    flows at once.
  - Left open: deleting a workspace asks no confirmation, and the view
    doesn't rerender when a search finishes while it is open.

### D27. History, suggestions, query cache, shortcut list and prefix chip: implemented in step 5c; Ctrl+N needs you

**History.** A committed search (the `q` in the URL) is recorded once it
has stayed there for 1 s. The URL takes the query 150 ms after typing
pauses, so typing "react" commits "r", "re", "rea" on the way; recording
each commit would fill history with fragments. A repeat (same registry,
text compared without case) adds one to `count` and moves `lastUsed`. The
list keeps 100 entries and drops the lowest-ranked first.

**Frecency.** `count × 0.5^(age / 7 days)`. Every score shares the same
decay factor, so the order doesn't depend on the current time: ranking
measures age from the newest entry, which keeps render pure
(`react/purity`). Ties go to the most recent use.

**Suggestions.** They appear under the search box once the user types. The
list holds, in order: up to 3 pins whose name starts with the typed text,
then up to 5 history entries by frecency, then up to 3 live results, with
at most 8 in all. A prefix limits all three groups to its registry. Entries
that would put the same query in the box appear once, and the current query
is never suggested.

- "Live results" means the first results of the search for the typed text
  that are already in the query cache (`useQueries` with `enabled: false`).
  They cost no request and no new endpoint, and they appear when the
  debounced search answers. The cards below show the rest.
- Choosing a pin or result puts `registry:name` in the box. Once 5a's
  package page lands, choosing a pin could open the package instead.

**Keys.** The search box follows the WAI-ARIA combobox pattern:
`role="combobox"`, `aria-expanded`, `aria-controls`, and
`aria-activedescendant` on a `listbox` of `option`s. Focus never leaves the
box. The e2e flows now find the box by its `combobox` role.

- The list opens when the user types, not on focus. Focusing the box and
  pressing ↓ still moves to the first card, as in D23.
- While the list is open, the search box and the cards form one vertical
  list:
  - ↓ or Ctrl+N moves down the suggestions. Past the last one, it moves to
    the first card and the list closes.
  - ↑ or Ctrl+P moves up, back to the typed text.
  - Enter chooses the active suggestion.
  - Escape closes the list. The next Escape clears the query, as before.
- These keys are `useHotkey` registrations from `HOTKEYS`, targeted at the
  input. The hotkey manager handles the innermost target first and stops
  propagation (the default), so the `<main>` registrations from D23 don't
  run. They are enabled only while they apply. That is how ↓ falls through
  to the cards after the last suggestion.
- TanStack Hotkeys treats an expanded combobox as an Escape layer, so the
  document-level Escape also yields while the list is open.
- With a mouse, pressing an option chooses it. The press is prevented, so
  focus stays in the box.

**Query cache (flow 3).** `persistQueryClient` from
`@tanstack/react-query-persist-client` stores the cache in IndexedDB. It
writes through `@tanstack/query-async-storage-persister` and
`idb-keyval` 6.3.0. Both persist packages are 5.108.4.

- Why `idb-keyval`: wrapping an `IDBRequest` needs `new Promise`, which
  `promise/avoid-new` bans. The async persister is typed for strings, so it
  stores JSON.
- The router's `Wrap` starts the persister in an effect, after hydration
  (D15).
- Only `["search", …]` queries with `ok: true` are saved. `maxAge` is the
  spec's 7-day stale window. Saving and restoring also check each query's
  last successful fetch time. After restoring, the first save includes SSR
  results from direct links. The buster is the `package.json` version.
- In the browser, `gcTime` is also 7 days. Otherwise an idle search leaves
  memory after 5 minutes, and the next save drops it from IndexedDB.
- The search loader waits for a restore in progress. A search typed right
  after a reload then reads the restored results instead of racing the
  IndexedDB read and waiting on the network.
- Revalidation follows `STALE_MS` (60 s). A result restored within 60 s of
  its fetch is still fresh and sends no request. The e2e flow moves the page
  clock 2 minutes ahead, blocks every search request without answering it,
  and checks two things: the reloaded search renders, and a revalidation
  request goes out.
- The persister adds 1,256 B Brotli to the entry. That's too little to
  load it lazily.

**Shortcut list.** Shift+? opens a native modal `<dialog>`, which traps
focus, closes on Escape and restores focus. It is a lazy chunk (1,059 B).
The list has one row per label, with every key for it, formatted by
`useFormatForDisplay`. Like other Shift combos, the key is ignored in text
fields. `__root.tsx` mounts it with one line.

**Ctrl+N and Ctrl+P.** Both are registered next to ↓ and ↑. Ctrl+P works
everywhere: the hotkey cancels it, so the print dialog doesn't open
(asserted in e2e). Ctrl+N can't work in a normal browser window on Windows
or Linux:

- Chromium (commit `749b032`, `chrome/browser/ui/accelerator_table.cc`):
  `{VKEY_N, EF_PLATFORM_ACCELERATOR, IDC_NEW_WINDOW}`, and `IDC_NEW_WINDOW`
  is in `kReservedCommandIds`. `IDC_PRINT` is not.
  `BrowserCommandController::IsReservedCommandOrKey` reserves nothing in
  app windows and only Exit and Fullscreen in fullscreen.
- Firefox: `key_newNavigator` has `modifiers="accel" reserved="true"`
  (`browser-sets.inc`). Bug 1291706 asked to let pages use Ctrl+N and was
  closed WONTFIX.
- Ctrl+N does reach the page on macOS, where the browser shortcut is Cmd+N.
  It also reaches installed PWA windows and fullscreen.
- The e2e flow passes Ctrl+N because Playwright's CDP input skips browser
  accelerators. It proves the handler, not real Windows or Linux behavior.

Proposal, not shipped: add Alt+J and Alt+K as next and previous on every
platform. Neither is a Firefox menu letter or a Chrome shortcut. This
changes the spec's keyboard map, so it needs your approval.

**Prefix chip (flow 2).** `splitPrefix` and `joinPrefix` in
`src/shared/query.ts`. They keep the text after the prefix exactly as
typed. `parseQuery` trims, and the box would lose a typed space.

- The URL keeps the raw `q`, e.g. `npm:zod`.
- Text that brings its own prefix (a paste of `crate:serde`) replaces the
  chip.
- Backspace on empty text removes the chip. The chip is also a button for
  the mouse, with `tabIndex={-1}` so it adds no tab stop.

**TypeScript lib.** `unicorn/no-array-sort` requires `toSorted()`, which
needs `lib: ES2023`. `tsconfig.json` now uses it. This changes types only.
Vite's default browser targets all have `toSorted`.

**Search outcomes.**

- Failed background revalidation keeps the last successful data and its
  timestamp. The results stay visible alongside the error and Retry.
- History counts every committed search, including ones with no results.

### D28. crates.io adapter and the 1 req/s queue: implemented in step 6a

- **Adapter** (`src/server/registries/crates.ts`). Search is
  `GET /api/v1/crates?q=&per_page=10`, 10 results rather than npm's 20,
  because each license lookup waits for its own slot (D13). The package
  endpoint is `GET /api/v1/crates/{name}?include=default_version,downloads`:
  the crate plus only its default version, 2.7 KB for serde against
  441 KB for the full response with every version. `downloads` in `include`
  fills `recent_downloads`, which is null without it.
- **Fields.** Search cards show `max_stable_version`, or `default_version`
  for a crate with only pre-releases, and `updated_at` as the release date.
  The package page shows the default version's number, license and
  `created_at`. Downloads are the 90-day `recent_downloads` (D14).
- **Queue** (`src/server/rate-slot.ts`, table `rate_slots`). Each request
  reserves the next send time with one atomic upsert:
  `next_at = greatest(next_at, now) + 1000`, on the database clock, so
  instances with skewed clocks still agree. A reservation that would wait
  more than 8 s is refused (the upsert's `WHERE` returns no row) and takes no
  place in the queue. The search or lookup then fails like any other
  upstream error. Without `DATABASE_URL` (local dev) the queue lives in
  memory. With `GERCH_REPLAY_DIR` (e2e) there is no queue: recorded
  responses never reach crates.io.
- **Timeout after the wait.** The 5 s upstream timeout wraps the network
  fetch inside the queue (`withTimeout` in `src/server/http.ts`), so it
  starts when the request leaves. Before review it started in `getJson`,
  so a wait of 5 s or more reached crates.io with an aborted signal.
- **Licenses on cards.** `useLazyLicenses` looks up each crate in a result
  list without a license through the package endpoint, one at a time in
  result order. So one open search page holds at most one place in the
  queue. Answers go through the usual package cache: 6 h fresh on the
  server, plus the persisted client cache. A repeated search shows every
  license at once. The e2e flow asserts the order and that only one lookup
  is in flight at a time.
- **Cache.** crates.io packages are fresh for 6 h and served stale up to
  30 days, per the spec. `packageCdnCache(registry)` sets the matching
  `s-maxage`.
- **Cold entry** grows by 236 B Brotli: 142,523 B on `main`, 142,759 B
  here, against the 150 kB budget. Measured from the JS each page's server
  HTML loads.
- **Known noise.** A lookup still in flight when the page navigates away is
  aborted by the browser, and Start's request handler logs that
  `AbortError` with `console.error` (`resolveErrorStatus` in
  `@tanstack/start-server-core`). The lookup itself finishes and fills the
  server cache. The e2e server logs about 20 of these per run, because
  every unprefixed `zod` search now looks up crates.
- **One lookup per page, not per user.** The lookups don't pass the query's
  abort signal, so changing the search leaves the old chain's one lookup in
  flight while the new chain starts. The server queue still holds the
  1 req/s limit; a fast typist can briefly hold two places in it.
