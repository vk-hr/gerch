import { USER_AGENT } from "@/server/registries/upstream.server"
import { mkdir, writeFile } from "node:fs/promises"

const FIXTURE_DIR = "src/server/registries/__tests__/fixtures"

type Case = {
  name: string
  url: string
  method?: "GET" | "POST"
  body?: string
  headers?: Record<string, string>
  raw?: boolean
  basicAuth?: boolean
  trim?: (json: unknown) => unknown
  available?: () => boolean
  reason?: string
}

const cases: Case[] = [
  {
    name: "npm-search",
    url: "https://registry.npmjs.org/-/v1/search?text=react&size=5",
  },
  {
    name: "npm-doc",
    url: "https://registry.npmjs.org/react",
    trim: (json) => {
      if (!isRecord(json) || !isRecord(json["dist-tags"])) return json
      const latest = json["dist-tags"].latest
      const versions = isRecord(json.versions) ? json.versions : {}
      return {
        ...json,
        time: undefined,
        versions:
          typeof latest === "string" ? { [latest]: versions[latest] } : {},
      }
    },
  },
  {
    name: "npm-unpkg-readme",
    url: "https://unpkg.com/react@19.3.1/README.md?raw",
    raw: true,
  },
  {
    name: "crates-search",
    url: "https://crates.io/api/v1/crates?q=react&per_page=5",
  },
  {
    name: "crates-detail",
    url: "https://crates.io/api/v1/crates/react",
  },
  {
    name: "docsrs-readme",
    url: "https://docs.rs/serde/latest/serde/",
    raw: true,
  },
  {
    name: "nix-search",
    url: "https://search.nixos.org/backend/latest-52-nixos-unstable/_search",
    method: "POST",
    basicAuth: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: { match_all: {} }, size: 2 }),
    available: () =>
      !!(
        process.env.SERVER_NIX_ES_USERNAME && process.env.SERVER_NIX_ES_PASSWORD
      ),
    reason: "SERVER_NIX_ES_USERNAME/PASSWORD are not set",
  },
]

async function record(testCase: Case): Promise<void> {
  if (testCase.available && !testCase.available()) {
    console.log(`- skipped ${testCase.name}: ${testCase.reason}`)
    return
  }

  const response = await fetch(testCase.url, {
    method: testCase.method ?? "GET",
    body: testCase.body,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      ...basicAuthHeader(testCase),
      ...testCase.headers,
    },
  })

  if (!response.ok) {
    throw new Error(
      `${testCase.name}: ${response.status} ${response.statusText}`
    )
  }

  const file = `${FIXTURE_DIR}/${testCase.name}.${
    testCase.raw ? "raw" : "json"
  }`
  const body = testCase.raw
    ? await response.text()
    : `${JSON.stringify(
        testCase.trim
          ? testCase.trim(await response.json())
          : await response.json(),
        null,
        2
      )}\n`
  await writeFile(file, body)

  console.log(`- recorded ${testCase.name} -> ${file}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function basicAuthHeader(testCase: Case): Record<string, string> {
  if (!testCase.basicAuth) return {}
  const credentials = `${process.env.SERVER_NIX_ES_USERNAME}:${process.env.SERVER_NIX_ES_PASSWORD}`
  return { Authorization: `Basic ${btoa(credentials)}` }
}

await mkdir(FIXTURE_DIR, { recursive: true })

await Promise.all(cases.map((testCase) => record(testCase)))
