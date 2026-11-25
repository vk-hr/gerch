// Records real registry responses once into test/fixtures/<registry>/, so
// unit and contract tests never touch the network. Rerun only on purpose:
// `bun run record-fixtures npm`, or `bun run record-fixtures npm package-` to
// record only the fixtures whose names start with that prefix.
import { USER_AGENT } from "@/server/http.ts"

const FIRST_ARG = 2
const JSON_INDENT = 2

const requests: Record<string, Record<string, string>> = {
  npm: {
    "search-zod": "https://registry.npmjs.org/-/v1/search?text=zod&size=20",
    "search-react-query":
      "https://registry.npmjs.org/-/v1/search?text=react%20query&size=20",
    "search-nonsense":
      "https://registry.npmjs.org/-/v1/search?text=gerch-no-such-package-q7x2&size=20",
    "package-zod-latest": "https://registry.npmjs.org/zod/latest",
    "package-zod-downloads":
      "https://api.npmjs.org/downloads/point/last-week/zod",
    "package-trpc-tanstack-react-query-latest":
      "https://registry.npmjs.org/%40trpc%2Ftanstack-react-query/latest",
    "package-trpc-tanstack-react-query-downloads":
      "https://api.npmjs.org/downloads/point/last-week/%40trpc%2Ftanstack-react-query",
    "package-nonsense-latest":
      "https://registry.npmjs.org/gerch-no-such-package-q7x2/latest",
    "package-nonsense-downloads":
      "https://api.npmjs.org/downloads/point/last-week/gerch-no-such-package-q7x2",
  },
}

const registry = Bun.argv[FIRST_ARG] ?? ""
const prefix = Bun.argv[FIRST_ARG + 1] ?? ""
const targets = requests[registry]
if (targets === undefined) {
  console.error(
    `usage: bun scripts/record-fixtures.ts <${Object.keys(requests).join("|")}> [name prefix]`
  )
  process.exit(1)
}

// Fixtures are committed, so drop maintainers' and publishers' emails.
function withoutEmails(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => withoutEmails(item))
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "email")
        .map(([key, item]) => [key, withoutEmails(item)])
    )
  }
  return value
}

// One request at a time, as registry rate limits expect.
await Object.entries(targets)
  .filter(([name]) => name.startsWith(prefix))
  .reduce(async (previous, [name, url]) => {
    await previous
    const response = await fetch(url, { headers: { "user-agent": USER_AGENT } })
    const body = withoutEmails(await response.json())
    const file = `test/fixtures/${registry}/${name}.json`
    await Bun.write(
      file,
      `${JSON.stringify({ body, status: response.status, url }, null, JSON_INDENT)}\n`
    )
    console.log(`${response.status} ${url} -> ${file}`)
  }, Promise.resolve())
