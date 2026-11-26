# CI directive

Make this repo's CI as fast as possible without letting it lie. The goal is the fastest CI that still checks everything, not a set of numbers: no check fails because a job or step took too long.

Three rules outrank speed:

- The full suite runs before anything reaches main, in a merge queue. Selection only narrows PR feedback.
- Never hide failures. No retries, wider timeouts or skipped tests. A check that needs a retry has a bug; find it.
- Never check less. Lint rules and required checks only stay or grow.

First, audit. Pull the last 150 runs and split every job into waiting, setup and running, at p50 and p95. Fix the biggest bucket first, then audit again.

Then:

- **Waiting:** GitHub's hosted runners. Cancel a branch's in-progress run when a new commit lands.
- **Setup:** get PR cache hits above 95% by seeding caches from main, and cache `node_modules` itself. Use a blobless clone (`filter: blob:none`).
- **Jobs:** no required job waits on another.
- **Lint:** `bun lint`. It reads the existing `.oxlintrc.json`. Turn on every rule you can.
- **Format:** `bun fmt`.
- **Typecheck:** `bun check` on TypeScript 7.
- **Tests:** `bun test`. Test files keep their `vitest` imports. Isolate modules, not processes, reset state after every file, and run in random order to flush out leaks.
- **Install and scripts:** bun. Delete npm, yarn, pnpm, Prettier, ESLint, oxlint, Vitest and Jest. If a tool only exists in a canary, pin that exact canary.
- **Shards:** buy cores before shards, match workers to cores, and give each shard its own throwaway database. Balance shards from the times main records on every full run, and prove the shards together ran every test.
- **Fewer tests, on evidence:** for two weeks, log every test failure you fix as a caught regression or a change detector. Delete the files that only detect change and ban their patterns in AGENTS.md. Never delete tests for authorization, privacy, migrations or concurrency.
- **Shape:** run lint, typecheck, build and tests in parallel. Fold the small checks into one job that lists every failure.
- **Selection:** on PRs, run only the tests the diff can reach, and list the inputs that rerun everything. Then hide a real change from it on purpose and confirm CI goes red.
- **Local:** hk hooks. Pre-commit formats and lints staged files; pre-push runs the same check as CI. A hook, not a line in AGENTS.md, because agents skip steps.
- **Keep it fast:** timings guide the work and never gate it. Re-run the audit after each change and fix the biggest bucket.

The tools above are defaults; you need a measured reason to keep an old one. Before each switch, run old and new side by side and list anything the new one misses.

One small PR per change, with before and after numbers from real runs. Do everything you can without me first; bring anything that needs an account, a secret or a bigger bill as one list with expected monthly cost. End with total CI time and cost, before and after.
