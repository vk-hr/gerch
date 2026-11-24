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
template rules, and runs with `--type-aware`. The first run flagged 99
problems on template code. Code was fixed where the finding was real.
Rules were turned off only for these reasons:

| Reason                                 | Rules off                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bans a language feature the stack uses | `oxc/no-async-await`, `oxc/no-optional-chaining`, `oxc/no-rest-spread-properties`, `eslint/no-ternary`                                                                                                                                                                                                                                                                                                                                            |
| Contradicts another enabled rule       | `import/no-named-export` and `import/prefer-default-export` (vs `import/no-default-export`); `import/exports-last` and `import/group-exports` (vs the file-route layout); `eslint/require-await` (vs `typescript/promise-function-async` and `typescript/return-await`)                                                                                                                                                                           |
| Contradicts a directive                | `vitest/no-importing-vitest-globals` (test files keep their `vitest` imports); `vitest/require-test-timeout` (no per-test timeouts)                                                                                                                                                                                                                                                                                                               |
| Doesn't fit the stack                  | `react/react-in-jsx-scope` (automatic JSX runtime); `react/forbid-component-props` (Tailwind `className`); `react/jsx-no-literals` (no i18n); `typescript/explicit-function-return-type`, `typescript/explicit-module-boundary-types` (Router and Query rely on inferred types); `typescript/prefer-readonly-parameter-types` (library prop types aren't deep-readonly); `unicorn/text-encoding-identifier-case` (HTML `charSet` must be `utf-8`) |
| Template had it off                    | `eslint/sort-keys`, `eslint/sort-imports`                                                                                                                                                                                                                                                                                                                                                                                                         |

Configured rather than turned off: `func-style` (declarations, arrows
allowed), `one-var` (`never`), `no-use-before-define` (hoisted functions
allowed), `no-magic-numbers` (ignores -1, 0, 1), `jsx-max-depth` (5),
`jsx-filename-extension` (`.tsx`), `capitalized-comments` (consecutive lines
allowed), `no-duplicate-imports` (separate `import type` allowed),
`vitest/consistent-test-it` (`test`). Scoped overrides: `scripts/**`
(console, `process.exit`, sync calls, top-level await), `*.config.ts`
(default export), `src/components/ui/**` (shadcn prop spreading and variant
exports), `src/routes/**` (`only-export-components`; the Start plugin handles
route HMR), tests (magic numbers, parent imports), `test/fixtures/**`
(`require-hook`), `*.d.ts` (`import/unambiguous`).

Timings on this repo: `bun lint --type-aware` 168 ms, `bun fmt --check`
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

The closest equivalent is a ruleset on `main` that requires a PR, the status
check `full-suite`, and branches up to date before merging. The `full-suite`
job runs every check with no test selection on each PR head. Combined with
"up to date", this tests the exact tree that lands on main, which is what a
single-author merge queue provides. I'll show you the ruleset before applying
it in step 2.

### D9. Directive budgets on a new repo: proposed

- Every budget applies from the first workflow. Each job ends with a step
  that compares elapsed job time to its budget and fails over it. A budget
  step for `bun lint`, `bun fmt` and `bun check` times each command.
- The 150-run audit runs once 150 runs exist. The test-failure log
  (`docs/test-failures.md`) starts with the first test.
- "Bake the toolchain into the runner image" isn't possible on free
  GitHub-hosted runners. Setup comes from a cached canary tarball and a cached
  `node_modules`, with caches seeded by a workflow on `push` to `main`.
- **Waiting budget: approved 2026-11-24.** GitHub's queue time isn't
  something our code controls, and without Blacksmith roughly a quarter of
  jobs will wait over 5 s (D8). Failing those jobs would turn CI red for
  reasons no commit can fix. So jobs fail on setup and running budgets only.
  Waiting is recorded per job in the job summary and the 150-run audit,
  against the 5 s target.
- Shape: one `checks` job (format, lint, typecheck, conventional commits; it
  reports every failure before exiting), plus `test` (sharded),
  `build-budgets` (build plus byte budgets) and `e2e` (Playwright on its own
  build). No job uses `needs:`.
- Selection: on PRs, `bun test --changed=origin/main`. These inputs rerun
  everything: `package.json`, `bun.lock`, `bunfig.toml`, `tsconfig.json`,
  `vite.config.ts`, `test/setup*`, `test/fixtures/**`, `.github/**`,
  `flake.nix`, `flake.lock`. A planted test proves selection can go red.
- Tests run with `bun test --isolate=modules --randomize` and `vitest`
  imports, which Bun maps through `--globals=bun` (verified flags). Shards
  use `--shard=i/n --timings`, with timings recorded by main
  (`--update-timings`). A final step checks that the shard file lists add up
  to every test file.

## App

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

Decided 2026-11-24.

- **Vercel Hobby, $0/month.** Hobby is limited to personal, non-commercial
  use. A portfolio project fits, but client work hosted on it would not.
  - Vercel's Bun runtime is in beta and accepts only `bunVersion: "1.4.x"`,
    with Vercel choosing the patch. Production therefore can't run the pinned
    canary. Server code must only use APIs that stable Bun 1.4 has; CI tests
    on the canary.
  - Step 3 checks whether Start's Vercel output can target the Bun runtime.
    If it can't, functions run on Node, and the Postgres client is
    `postgres@4.1.1` instead of `Bun.SQL`.
- **Supabase Free, $0/month:** 500 MB database, shared CPU, 500 MB RAM,
  5 GB egress. It pauses after a week without activity (see D12). Pro is
  $25/month if the nix index or traffic outgrows Free.
- Domain: still open, for example `gerch.vkhr.dev`.

### D20. Deploys and secrets: needs you

Recommendation: CI builds with the pinned canary, then runs `vercel build`
and `vercel deploy --prebuilt` after the full suite passes on `main`. PR
previews use the same path. This keeps "same binary in CI" true for what
ships. The alternative, Vercel's Git integration, needs no GitHub secrets,
but Vercel installs and builds with its own Bun.

Secrets needed:

| Secret                                                  | Where                  | For                    |
| ------------------------------------------------------- | ---------------------- | ---------------------- |
| `DATABASE_URL` (Supabase transaction pooler, port 6543) | Vercel env             | server routes          |
| `DATABASE_URL` (Supabase session pooler or direct)      | GitHub Actions secret  | nix ingest, migrations |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`    | GitHub Actions secrets | prebuilt deploys       |

None of these are needed before step 3.

### D21. Database in tests: proposed

Unit and contract tests use PGlite (`@electric-sql/pglite`), an in-process
WASM Postgres, with a fresh instance per test file. This matches the CI
directive's "each shard its own throwaway database" with no service
container and no setup time. Migrations run on PGlite in tests and on
Supabase in deploys. One opt-in test runs the migrations against a real
Postgres from the Nix dev shell to catch PGlite gaps.
