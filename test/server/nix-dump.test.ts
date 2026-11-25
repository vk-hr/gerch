import { describe, expect, test } from "vitest"

import { nixRows } from "@/server/nix/dump.ts"
import type { NixRow } from "@/server/nix/dump.ts"

import { nixDump } from "../support/nix.ts"

async function row(attr: string): Promise<NixRow | undefined> {
  const rows = nixRows(await nixDump())
  return rows.find((candidate) => candidate.attr === attr)
}

describe("nix dump", () => {
  test("maps a package with a compound license", async () => {
    expect.hasAssertions()
    await expect(row("ripgrep")).resolves.toStrictEqual({
      attr: "ripgrep",
      description:
        "Utility that combines the usability of The Silver Searcher with the raw speed of grep",
      homepage: "https://github.com/BurntSushi/ripgrep",
      license: "Unlicense OR MIT",
      mainProgram: "rg",
      pname: "ripgrep",
      version: "15.2.0",
    })
  })

  test.each([
    ["rustc", "MIT, Apache-2.0"],
    ["_1password-cli", "Unfree"],
    ["gitit", "GPL"],
    ["python313Packages.requests", "Apache-2.0"],
    ["appimage-run", null],
  ])("reads the license of %s as %p", async (attr, license) => {
    expect.hasAssertions()
    const found = await row(attr)
    expect(found?.license).toBe(license)
  })

  test("shows the first of several homepages", async () => {
    expect.hasAssertions()
    const found = await row("osmctools")
    expect(found?.homepage).toBe(
      "https://wiki.openstreetmap.org/wiki/osmconvert"
    )
  })

  test("keeps every recorded package", async () => {
    expect.hasAssertions()
    expect(nixRows(await nixDump())).toHaveLength(18)
  })

  test("skips an entry without a version and reads odd fields as missing", () => {
    expect.hasAssertions()
    const rows = nixRows({
      packages: {
        broken: { pname: "broken" },
        odd: {
          meta: { description: 7, homepage: "ftp://x", license: [3] },
          version: "1",
        },
      },
      version: 2,
    })
    expect(rows).toStrictEqual([
      {
        attr: "odd",
        description: null,
        homepage: null,
        license: null,
        mainProgram: null,
        pname: "odd",
        version: "1",
      },
    ])
  })
})
