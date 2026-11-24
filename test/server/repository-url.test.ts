import { describe, expect, test } from "vitest"

import { repositoryUrl } from "@/server/registries/repository-url.ts"

describe("repositoryUrl()", () => {
  test("turns git remotes into browsable https URLs", () => {
    expect.hasAssertions()
    const cases: [string, string][] = [
      [
        "git+https://github.com/colinhacks/zod.git",
        "https://github.com/colinhacks/zod",
      ],
      ["git://github.com/a/b.git", "https://github.com/a/b"],
      ["git+ssh://git@github.com/a/b.git", "https://github.com/a/b"],
      ["git@github.com:a/b.git", "https://github.com/a/b"],
      ["https://gitlab.com/a/b", "https://gitlab.com/a/b"],
    ]
    for (const [input, output] of cases) {
      expect(repositoryUrl(input)).toBe(output)
    }
  })

  test("returns null for missing or unusable values", () => {
    expect.hasAssertions()
    for (const input of [undefined, "", "github:a/b", "not a url"]) {
      expect(repositoryUrl(input)).toBeNull()
    }
  })
})
