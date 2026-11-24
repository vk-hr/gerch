import { describe, expect, test } from "vitest"

import { BUN_NPM_VERSION } from "../scripts/check-bun.ts"

const root = new URL("..", import.meta.url)

async function read(path: string): Promise<string> {
  return Bun.file(new URL(path, root)).text()
}

function lockEntry(lockText: string, name: string): unknown[] {
  const lock: unknown = Bun.JSONC.parse(lockText)
  if (typeof lock !== "object" || lock === null || !("packages" in lock)) {
    throw new Error("bun.lock has no packages")
  }
  const { packages } = lock
  if (typeof packages !== "object" || packages === null) {
    throw new TypeError("bun.lock packages is not an object")
  }
  const entry: unknown = Object.entries(packages).find(([key]) => key === name)
  if (!Array.isArray(entry) || !Array.isArray(entry[1])) {
    throw new TypeError(`bun.lock has no entry for ${name}`)
  }
  return entry[1]
}

describe("bun canary pin", () => {
  test("package.json pins the same canary as scripts/check-bun.ts", async () => {
    expect.hasAssertions()
    const pkg: unknown = JSON.parse(await read("package.json"))
    expect(pkg).toMatchObject({ devDependencies: { bun: BUN_NPM_VERSION } })
  })

  test("flake.nix fetches the same canary with the bun.lock hashes", async () => {
    expect.hasAssertions()
    const [flake, lockText] = await Promise.all([
      read("flake.nix"),
      read("bun.lock"),
    ])
    expect(flake).toContain(`bunVersion = "${BUN_NPM_VERSION}";`)

    const tarballs = [
      ...flake.matchAll(/pkg = "(?<pkg>[^"]+)";\s*hash = "(?<hash>[^"]+)";/gu),
    ]
    expect(tarballs.length).toBeGreaterThan(0)
    for (const { groups } of tarballs) {
      const name = `@oven/${groups?.pkg}`
      const entry = lockEntry(lockText, name)
      expect(entry[0]).toBe(`${name}@${BUN_NPM_VERSION}`)
      expect(entry.at(-1)).toBe(groups?.hash)
    }
  })
})
