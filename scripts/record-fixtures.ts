// Records real registry responses once into test/fixtures/<registry>/, so
// unit and contract tests never touch the network. Rerun only on purpose:
// `bun run record-fixtures npm`, or `bun run record-fixtures crate package-` to
// record only the fixtures whose names start with that prefix.
import { USER_AGENT } from "@/server/http.ts"
import { CHANNEL_URL, nixDumpSchema } from "@/server/nix/dump.ts"

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
  crate: {
    "search-serde": "https://crates.io/api/v1/crates?q=serde&per_page=10",
    "search-zod": "https://crates.io/api/v1/crates?q=zod&per_page=10",
    "search-nonsense":
      "https://crates.io/api/v1/crates?q=gerch-no-such-package-q7x2&per_page=10",
    "package-serde":
      "https://crates.io/api/v1/crates/serde?include=default_version,downloads",
    "package-serde_json":
      "https://crates.io/api/v1/crates/serde_json?include=default_version,downloads",
    "package-nonsense":
      "https://crates.io/api/v1/crates/gerch-no-such-package-q7x2?include=default_version,downloads",
    // The rest of the serde results, so a recorded search fills every license.
    "package-serde-saphyr":
      "https://crates.io/api/v1/crates/serde-saphyr?include=default_version,downloads",
    "package-clickhouse":
      "https://crates.io/api/v1/crates/clickhouse?include=default_version,downloads",
    "package-serde_yml":
      "https://crates.io/api/v1/crates/serde_yml?include=default_version,downloads",
    "package-serde_valid":
      "https://crates.io/api/v1/crates/serde_valid?include=default_version,downloads",
    "package-serde_toon_format":
      "https://crates.io/api/v1/crates/serde_toon_format?include=default_version,downloads",
    "package-yaml_serde":
      "https://crates.io/api/v1/crates/yaml_serde?include=default_version,downloads",
    "package-serde_json_borrow":
      "https://crates.io/api/v1/crates/serde_json_borrow?include=default_version,downloads",
    "package-rust_decimal":
      "https://crates.io/api/v1/crates/rust_decimal?include=default_version,downloads",
  },
  nix: { "channel-dump": CHANNEL_URL },
}

// The nixpkgs dump is 10.6 MB of Brotli (418 MB of JSON). The fixture keeps
// these real entries, with only the fields gerch reads.
const NIX_SAMPLE = [
  "_1password-cli",
  "appimage-run",
  "emacsPackages.projectile-ripgrep",
  "emacsPackages.ripgrep",
  "firefox",
  "gitit",
  "hello",
  "libserdes",
  "nodejs_22",
  "osmctools",
  "python313Packages.requests",
  "python313Packages.zodb",
  "python314Packages.requests",
  "ripgrep",
  "ripgrep-all",
  "rustc",
  "vimPlugins.blink-ripgrep-nvim",
  "zod",
]
const NIX_META = ["description", "homepage", "license", "mainProgram"]

function pick(
  value: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? Object.fromEntries(
        Object.entries(value).filter(([key]) => keys.includes(key))
      )
    : {}
}

function nixSample(dump: unknown) {
  const { packages } = nixDumpSchema.parse(dump)
  return {
    packages: Object.fromEntries(
      NIX_SAMPLE.map((attr) => {
        const picked = pick(packages[attr], ["meta", "pname", "version"])
        return [attr, { ...picked, meta: pick(picked.meta, NIX_META) }]
      })
    ),
    version: 2,
  }
}

// The dump is served with `content-encoding: br`, so fetch decodes it.
async function bodyOf(response: Response, from: string): Promise<unknown> {
  const body: unknown = await response.json()
  return from === "nix" ? nixSample(body) : body
}

// The crates.io limit is one request per second (docs/spec.md, "Data sources").
const SPACING_MS: Record<string, number> = { crate: 1000 }

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
    await Bun.sleep(SPACING_MS[registry] ?? 0)
    const response = await fetch(url, { headers: { "user-agent": USER_AGENT } })
    const body = withoutEmails(await bodyOf(response, registry))
    const file = `test/fixtures/${registry}/${name}.json`
    await Bun.write(
      file,
      `${JSON.stringify({ body, status: response.status, url }, null, JSON_INDENT)}\n`
    )
    console.log(`${response.status} ${url} -> ${file}`)
  }, Promise.resolve())
