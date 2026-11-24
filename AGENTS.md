# AGENTS.md

## Commands

Run everything inside the Nix dev shell (`direnv` loads it from `.envrc`).
The shell provides the pinned Bun canary; the global `bun` is stable and
lacks `bun lint`, `bun fmt` and `bun check`.

| Task                     | Command                      |
| ------------------------ | ---------------------------- |
| Install                  | `bun ci`                     |
| All checks (as pre-push) | `bun run verify`             |
| Format                   | `bun fmt`                    |
| Lint                     | `bun lint --type-aware`      |
| Typecheck                | `bun check`                  |
| Test                     | `bun test --isolate=modules` |
| Dev server               | `bun run dev`                |
| Build                    | `bun run build`              |
| Check the Bun pin        | `bun run check-bun`          |

hk hooks run on commit (format and lint staged files, Conventional Commits
message) and on push (`bun run verify`). Install them with `hk install`.

## Structure

- `src/routes/`: TanStack Start file routes and `/api/*` server routes.
- `src/components/ui/`: shadcn components (style `base-luma`, Base UI).
- `scripts/`: Bun scripts (`check-bun.ts`, `verify.ts`).
- `test/`: tests and recorded fixtures (`test/fixtures/`).
- `docs/spec.md`, `docs/decisions.md`: scope and decisions.
- `docs/directives/`: binding directives. Ask before changing them.

## Banned patterns

- `bun test` without `--isolate=modules`. `bunfig.toml` has no isolate key.
- Network calls in unit tests. Use recorded fixtures.
- Retries, wider timeouts or skipped tests to make CI pass.
- `eslint-disable` or `@ts-expect-error` to hide a finding. Fix it, or change
  the rule in `.oxlintrc.json` and record why in `docs/decisions.md`.
- Comments that explain away a workaround. Fix it or record it in
  `docs/decisions.md`.
- Commit messages that are not Conventional Commits.
- npm, yarn, pnpm, Prettier, ESLint, oxlint, Vitest or Jest.
