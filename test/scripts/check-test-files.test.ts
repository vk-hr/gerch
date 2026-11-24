import { describe, expect, test } from "vitest"

import { missingTestFiles } from "../../scripts/check-test-files.ts"

const junit = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="bun test" tests="2">
  <testsuite name="test/a.test.ts" file="test/a.test.ts" tests="1">
    <testsuite name="inner" file="test/a.test.ts" tests="1" />
  </testsuite>
  <testsuite name="test/b.test.ts" file="test/b.test.ts" tests="1" />
</testsuites>`

describe("missingTestFiles()", () => {
  test("is empty when every file ran", () => {
    expect.hasAssertions()
    expect(
      missingTestFiles([junit], ["test/a.test.ts", "test/b.test.ts"])
    ).toStrictEqual([])
  })

  test("lists files that no report mentions", () => {
    expect.hasAssertions()
    expect(
      missingTestFiles(
        [junit],
        ["test/a.test.ts", "test/b.test.ts", "test/c.test.ts"]
      )
    ).toStrictEqual(["test/c.test.ts"])
  })

  test("merges reports from several shards", () => {
    expect.hasAssertions()
    const shard2 = `<testsuites><testsuite file="test/c.test.ts" /></testsuites>`
    expect(
      missingTestFiles([junit, shard2], ["test/a.test.ts", "test/c.test.ts"])
    ).toStrictEqual([])
  })
})
