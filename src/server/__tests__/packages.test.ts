import { getPackageHandler } from "@/server/packages"
import { UpstreamError } from "@/server/registries/upstream.server"
import { describe, expect, it, vi } from "vitest"

const { searchNixMock, npmPackageMock, cratesPackageMock } = vi.hoisted(() => ({
  searchNixMock: vi.fn(),
  npmPackageMock: vi.fn(),
  cratesPackageMock: vi.fn(),
}))

vi.mock("@/server/registries/nix", () => ({
  searchNix: searchNixMock,
}))
vi.mock("@/server/registries/npm", () => ({
  npmPackage: npmPackageMock,
}))
vi.mock("@/server/registries/crates", () => ({
  cratesPackage: cratesPackageMock,
}))

const nixRecord = {
  registry: "nix" as const,
  name: "firefox-bin",
  version: "140.0",
  links: {},
}

describe("getPackage", () => {
  it("forwards the requested channel to nix search", async () => {
    searchNixMock.mockResolvedValue({ ok: true, records: [nixRecord] })

    await getPackageHandler({
      registry: "nix",
      name: "firefox-bin",
      channel: "nixos-26.05",
    })

    expect(searchNixMock).toHaveBeenCalledWith({
      data: { q: "firefox-bin", channel: "nixos-26.05" },
    })
  })

  it("distinguishes a missing nix package from an outage", async () => {
    searchNixMock.mockResolvedValueOnce({ ok: true, records: [] })
    await expect(
      getPackageHandler({ registry: "nix", name: "missing" })
    ).resolves.toMatchObject({ notFound: true })

    searchNixMock.mockResolvedValueOnce({
      ok: false,
      reason: "unavailable",
    })
    await expect(
      getPackageHandler({ registry: "nix", name: "missing" })
    ).rejects.toMatchObject({ status: 503 })
  })

  it("treats schema drift without an exact record as an upstream error", async () => {
    searchNixMock.mockResolvedValue({
      ok: true,
      records: [],
      degraded: true,
    })

    await expect(
      getPackageHandler({ registry: "nix", name: "firefox-bin" })
    ).rejects.toMatchObject({ status: 502 })
  })

  it("maps npm 404 to not found and preserves other errors", async () => {
    npmPackageMock.mockRejectedValueOnce(new UpstreamError(404, "missing"))
    await expect(
      getPackageHandler({ registry: "npm", name: "missing" })
    ).resolves.toMatchObject({ notFound: true })

    npmPackageMock.mockRejectedValueOnce(new UpstreamError(503, "down"))
    await expect(
      getPackageHandler({ registry: "npm", name: "react" })
    ).rejects.toMatchObject({ status: 503 })
  })
})
