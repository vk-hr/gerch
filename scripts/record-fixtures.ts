import { mkdir, writeFile } from "node:fs/promises"

const USER_AGENT =
  process.env.SERVER_USER_AGENT ??
  "gerch-dev (https://github.com/gerch; contact: set SERVER_USER_AGENT)"

// TODO(Phase 0): move the UA constant into src/env.ts and import it here.
const FIXTURE_DIR = "src/server/registries/__tests__/fixtures"

type Case = {
  name: string
  url: string
  headers?: Record<string, string>
  available?: () => boolean
  reason?: string
}

const cases: Case[] = [
  {
    name: "npm-search",
    url: "https://registry.npmjs.org/-/v1/search?text=react&size=5",
  },
  {
    name: "crates-search",
    url: "https://crates.io/api/v1/crates?q=react&per_page=5",
  },
  {
    name: "nix-search",
    url: "https://search.nixos.org/backend/latest-42-nixos-25.05/_search",
    available: () => !!process.env.SERVER_NIX_ES_CREDENTIALS,
    reason: "SERVER_NIX_ES_CREDENTIALS is not set",
  },
]

async function record(testCase: Case): Promise<"recorded" | "skipped"> {
  if (testCase.available && !testCase.available()) {
    console.log(`- skipped ${testCase.name}: ${testCase.reason}`)
    return "skipped"
  }

  const response = await fetch(testCase.url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      ...testCase.headers,
    },
  })

  if (!response.ok) {
    throw new Error(
      `${testCase.name}: ${response.status} ${response.statusText}`
    )
  }

  const body = await response.json()
  const file = `${FIXTURE_DIR}/${testCase.name}.json`
  await writeFile(file, `${JSON.stringify(body, null, 2)}\n`)

  console.log(`- recorded ${testCase.name} -> ${file}`)
  return "recorded"
}

await mkdir(FIXTURE_DIR, { recursive: true })

await Promise.all(cases.map((testCase) => record(testCase)))
