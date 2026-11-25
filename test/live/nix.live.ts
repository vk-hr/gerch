// Opt-in smoke test against the real nixpkgs channel. Not picked up by
// `bun test`; run with `GERCH_LIVE=1 bun test ./test/live/nix.live.ts`. It
// only asks for the dump's headers: the dump itself is 10.6 MB, and the
// ingest reads it in the scheduled workflow (D30).
import { describe, expect, test } from "vitest"

import { USER_AGENT } from "@/server/http.ts"
import { CHANNEL_URL } from "@/server/nix/dump.ts"
import { releaseOf } from "@/server/nix/ingest.ts"

describe("nixpkgs live", () => {
  test("the channel dump redirects to a release with an ETag", async () => {
    expect.hasAssertions()
    const response = await fetch(CHANNEL_URL, {
      headers: { "user-agent": USER_AGENT },
      method: "HEAD",
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("etag")).toMatch(/^"[\da-f]+"$/u)
    expect(releaseOf(response.url)).toMatch(/^nixos-\d+\.\d+/u)
  })
})
