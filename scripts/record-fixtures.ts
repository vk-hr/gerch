// Records real registry responses once into test/fixtures/<registry>/, so
// unit and contract tests never touch the network. Rerun only on purpose:
// `bun run record-fixtures npm`.
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
  },
}

const registry = Bun.argv[FIRST_ARG] ?? ""
const targets = requests[registry]
if (targets === undefined) {
  console.error(
    `usage: bun scripts/record-fixtures.ts <${Object.keys(requests).join("|")}>`
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
await Object.entries(targets).reduce(async (previous, [name, url]) => {
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
