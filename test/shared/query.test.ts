import { describe, expect, test } from "vitest"

import { parseQuery } from "@/shared/query.ts"
import type { ParsedQuery } from "@/shared/query.ts"

const all = ["npm", "crate", "nix"] as const

const cases: [string, ParsedQuery][] = [
  ["zod", { prefix: null, registries: [...all], text: "zod" }],
  ["npm:zod", { prefix: "npm", registries: ["npm"], text: "zod" }],
  ["crate:serde", { prefix: "crate", registries: ["crate"], text: "serde" }],
  ["nix:ripgrep", { prefix: "nix", registries: ["nix"], text: "ripgrep" }],
  [
    "  NPM:  React Query ",
    { prefix: "npm", registries: ["npm"], text: "React Query" },
  ],
  [
    "pypi:requests",
    {
      prefix: null,
      registries: [...all],
      text: "pypi:requests",
    },
  ],
  ["npm:", { prefix: "npm", registries: ["npm"], text: "" }],
  ["", { prefix: null, registries: [...all], text: "" }],
]

describe("parseQuery()", () => {
  test.each(cases)("%j", (input, expected) => {
    expect.hasAssertions()
    expect(parseQuery(input)).toStrictEqual(expected)
  })
})
