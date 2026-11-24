# Performance directive

Build a fast client-rendered React app. Use TanStack Redact 0.3.1 as the default browser renderer.

## Stack

- Vite 8.3.8 with Rolldown, React and React DOM 19.3.1, React Compiler 1.0.0, strict TypeScript 7.0.2.
- TanStack Router 1.170.46 with router-plugin 1.169.0 for file-based routes.
- TanStack Query 5.108.5 for server data.
- Bun canary for development and CI (exact version pinned in the project prompt).

## Build with Redact

Register TanStack Router with `autoCodeSplitting` first, followed by `tailwindcss()` from `@tailwindcss/vite`, `react()`, Babel with `reactCompilerPreset()`, and `redact()` from `@tanstack/redact/vite`. Keep standard React imports. Keep a build switch for React DOM.

## Load on intent

- On entry, start critical queries in the route loader while its component downloads. Share one `QueryClient` and one `queryOptions` definition per resource. Await `queryClient.query(options)` for required fresh data and read it with `useSuspenseQuery`. Give secondary panels their own Suspense boundaries.
- For navigation, set `defaultPreload` to `'intent'`, `defaultPreloadDelay` to 50 ms, and `defaultPreloadStaleTime` to 0. Warm likely destinations on hover, keyboard focus, or touchstart. Disable preloading on low-value links.
- For editors and charts, warm the same `import()` used by `React.lazy` on deliberate hover, focus, or press. Open the feature on activation. Load rarely used tools on demand. Test direct links and cold taps.

## Keep the first view small

Fail CI above 150 kB total cold-entry JS, 50 kB route-specific startup JS, or 20 kB first-view CSS, all Brotli. Count each asset once across the shell, matched layouts, route chunks, and preloads. Verify with the Vite manifest and a cold browser trace. Count the CSS Tailwind actually emits. Make the LCP image discoverable early and reserve its dimensions.

## Ship on measured results

Run `bun ci`, `bun lint`, `bun fmt --check`, `bun check`, `bun test`, and `bun run build`. Run React Doctor on new PR findings. Use Playwright to replay cold entry, warm navigation, and typing during filtering with realistic data.

Profile one slow interaction at a time with the pinned React Doctor CLI:

```sh
bun run react-doctor scan "$PREVIEW_URL" --trace-out interaction.json.gz
```

Redact renders synchronously. Before release, compare both renderers on the same commit. Measure time to usable content and input latency while filtering the largest realistic list. Exercise forms, portals, and Suspense navigation. Ship Redact when cold entry improves and those interactions hold their baseline. Ship React DOM if Redact misses either condition or breaks a required flow.

Report before/after timings and bytes. Sample `web-vitals/attribution` by route template and release to find slow interactions in the field. Targets: p75 LCP ≤ 2.5 s, INP < 200 ms, CLS ≤ 0.1, and fully cached navigation to visible content ≤ 200 ms.
