import { env } from "@/env"
import {
  cratesPackageHandler,
  searchCratesHandler,
} from "@/server/registries/crates"
import { searchNixHandler } from "@/server/registries/nix"
import { npmPackageHandler, searchNpmHandler } from "@/server/registries/npm"
import { UpstreamError } from "@/server/registries/upstream"
import { describe, expect, it } from "vitest"

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
    return undefined
  } catch (error) {
    return error
  }
}

const hasNixCreds = Boolean(
  env.SERVER_NIX_ES_USERNAME && env.SERVER_NIX_ES_PASSWORD
)

describe("npm (live)", () => {
  it("searches the real registry", async () => {
    const records = await searchNpmHandler("react")
    expect(records.length).toBeGreaterThan(0)
    expect(records[0].registry).toBe("npm")
  })

  it("maps a missing package to a 404 UpstreamError", async () => {
    const error = await captureError(
      npmPackageHandler("gerch-definitely-not-real-xyz")
    )
    expect(error).toBeInstanceOf(UpstreamError)
    if (error instanceof UpstreamError) expect(error.status).toBe(404)
  })
})

describe("crates (live)", () => {
  it("searches the real registry", async () => {
    const records = await searchCratesHandler("serde")
    expect(records.length).toBeGreaterThan(0)
    expect(records[0].registry).toBe("crates")
  })

  it("maps a missing crate to a 404 UpstreamError", async () => {
    const error = await captureError(
      cratesPackageHandler("gerch-definitely-not-real-xyz")
    )
    expect(error).toBeInstanceOf(UpstreamError)
    if (error instanceof UpstreamError) expect(error.status).toBe(404)
  })
})

describe("nix (live)", () => {
  it.skipIf(!hasNixCreds)("searches the real index", async () => {
    const result = await searchNixHandler("ripgrep")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.records.length).toBeGreaterThan(0)
      expect(result.records[0].registry).toBe("nix")
    }
  })
})
