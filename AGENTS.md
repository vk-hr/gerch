# AGENTS.md

## Commands

Run everything inside the Nix dev shell (`direnv` loads it from `.envrc`).
The shell provides the pinned Bun canary; the global `bun` is stable and
lacks `bun lint`, `bun fmt` and `bun check`.

| Task                       | Command                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| Install                    | `bun ci`                                                            |
| All checks (as pre-push)   | `bun run verify`                                                    |
| Format                     | `bun fmt`                                                           |
| Lint                       | `bun lint`                                                          |
| Typecheck                  | `bun check`                                                         |
| Test                       | `bun test --isolate=modules`                                        |
| Dev server                 | `bun run dev`                                                       |
| Build                      | `bun run build`                                                     |
| Byte budgets (after build) | `bun scripts/check-budgets.ts`                                      |
| Build with React DOM       | `GERCH_RENDERER=react-dom bun run build`                            |
| Compare the renderers      | `bun scripts/measure-renderers.ts`                                  |
| End-to-end flows           | `bun x playwright test`                                             |
| Check the Bun pin          | `bun run check-bun`                                                 |
| Live smoke tests           | `GERCH_LIVE=1 bun test ./test/live/npm.live.ts` (or `crate`, `nix`) |
| Re-record fixtures         | `bun run record-fixtures npm` (`crate`, `nix`)                      |
| Refresh the nix index      | `DATABASE_URL=… bun scripts/ingest-nix.ts`                          |
| New migration              | `bun run drizzle-kit generate --name <change>`                      |
| Migrate the database       | `DATABASE_URL=… bun run migrate`                                    |

hk hooks run on commit (format and lint staged files, Conventional Commits
message) and on push (`bun run verify`). Install them with `hk install`.

## Structure

- `src/routes/`: TanStack Start file routes and `/api/*` server routes.
- `src/server/`: server-only code: registry adapters (`registries/`, wired
  in `adapters.ts`), SWR cache, the rate-limit queue (`rate-slot.ts`), the
  nix index and its ingest (`nix/`), and the Drizzle schema and connection
  (`src/server/db/`).
- `src/shared/`: types and pure helpers shared with the browser (no zod).
- `src/client/`: browser-only code: state saved in `localStorage` (tabs,
  workspaces, pins, history; read it with `useClientState`), the query
  persister, and the field vitals reporter (`vitals.ts`).
- `drizzle/`: generated migrations. Edit the schema, then generate.
- `src/components/ui/`: shadcn components (style `base-luma`, Base UI).
- `src/components/search/`: the search page, one component per file.
- `src/components/tabs/`, `src/components/package/`: the tab strip and the
  package page `/p/$registry/$name`.
- `src/components/workspaces/`: the pin picker and workspace view dialogs.
- `src/components/suggestions/`, `src/components/shortcuts/`: search
  suggestions with history ranking, and the `?` shortcut list.
- `e2e/`: Playwright flows against the production build, which answers
  registry requests from `test/fixtures/` (`GERCH_REPLAY_DIR`).
- `scripts/`: Bun scripts: `check-bun.ts`, `verify.ts` (all checks, with
  budgets), `check-budgets.ts` (byte budgets of a cold entry), and CI helpers (`select-tests.ts`, `ci-budget.ts`,
  `check-test-files.ts`, `check-commits.ts`).
- `.github/`: CI workflow and the setup action.
- `test/`: tests, recorded fixtures (`test/fixtures/`), the shared adapter
  contract (`test/contract/adapters.test.ts`), and opt-in live smoke tests
  (`test/live/*.live.ts`, not picked up by `bun test`).
- `docs/spec.md`, `docs/decisions.md`: scope and decisions.
- `docs/directives/`: binding directives. Ask before changing them.

## Banned patterns

- `bun test` without `--isolate=modules`. `bunfig.toml` has no isolate key.
- Pressing keys in an e2e flow before `body[data-interactive]`, or before
  the element the key acts on is visible (D23).
- A test or e2e server that can reach a real database. Bun loads
  `.env.local` (Supabase), so `playwright.config.ts` sets `DATABASE_URL` to
  an empty string (D30).
- Network calls in unit tests. Use recorded fixtures; the test preload
  blocks `fetch`.
- Retries, wider timeouts or skipped tests to make CI pass.
- `eslint-disable` or `@ts-expect-error` to hide a finding. Fix it, or change
  the rule in `.oxlintrc.json` and record why in `docs/decisions.md`.
- Comments that explain away a workaround. Fix it or record it in
  `docs/decisions.md`.
- Commit messages that are not Conventional Commits.
- npm, yarn, pnpm, Prettier, ESLint, oxlint, Vitest or Jest.
- Hand-written migrations, or editing generated files in `drizzle/`.
- `drizzle-kit push` against Supabase. Generate a migration and run
  `bun run migrate`.
