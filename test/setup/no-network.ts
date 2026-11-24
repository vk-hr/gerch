// Unit tests make no network calls (AGENTS.md). Live smoke tests opt in with
// GERCH_LIVE=1 and run by explicit path: `bun test ./test/live/npm.live.ts`.
function describeInput(input: RequestInfo | URL): string {
  if (input instanceof Request) {
    return input.url
  }
  return input instanceof URL ? input.href : input
}

if (process.env.GERCH_LIVE !== "1") {
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL): Promise<Response> => {
      throw new Error(
        `network is disabled in unit tests: ${describeInput(input)}`
      )
    },
    { preconnect: globalThis.fetch.preconnect }
  )
}

export { describeInput }
