import { describe, expect, test } from "vitest"

import { joinPrefix, parseQuery, splitPrefix } from "@/shared/query.ts"
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

describe("splitPrefix()", () => {
  test.each([
    ["npm:zod", { prefix: "npm", rest: "zod" }],
    ["NPM:react query ", { prefix: "npm", rest: "react query " }],
    ["npm:", { prefix: "npm", rest: "" }],
    ["  crate:serde", { prefix: "crate", rest: "serde" }],
    ["pypi:requests", { prefix: null, rest: "pypi:requests" }],
    ["zod ", { prefix: null, rest: "zod " }],
  ] as const)("%j", (input, expected) => {
    expect.hasAssertions()
    expect(splitPrefix(input)).toStrictEqual(expected)
  })
})

describe("joinPrefix()", () => {
  test.each([
    [null, "zod", "zod"],
    ["npm", "zod", "npm:zod"],
    ["npm", "", "npm:"],
    ["npm", "crate:serde", "crate:serde"],
  ] as const)("%s + %j", (prefix, rest, expected) => {
    expect.hasAssertions()
    expect(joinPrefix(prefix, rest)).toBe(expected)
  })
})
