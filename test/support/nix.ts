import { loadFixtures } from "@/server/replay.ts"

// The recorded channel dump sample (test/fixtures/nix/channel-dump.json).
async function nixDump(): Promise<unknown> {
  const [fixture] = await loadFixtures([
    new URL("../fixtures/nix/channel-dump.json", import.meta.url).pathname,
  ])
  return fixture?.body
}

export { nixDump }
