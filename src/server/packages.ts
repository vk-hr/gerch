import type { NixChannel } from "@/lib/nix-channel"
import type { PackageRecord } from "@/server/registries/record"

import { NIX_CHANNELS } from "@/lib/nix-channel"
import { cratesPackage } from "@/server/registries/crates"
import { searchNix } from "@/server/registries/nix"
import { npmPackage } from "@/server/registries/npm"
import { UpstreamError } from "@/server/registries/upstream-error"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"

const registrySchema = z.enum(["npm", "crates", "nix"])

export type PackageDetail = {
  record: PackageRecord
  readmeHtml?: string
  versions?: { num: string; created_at?: string }[]
  degraded?: boolean
}

export type PackageResult = PackageDetail | { notFound: true }

export async function getPackageHandler(input: {
  registry: string
  name: string
  channel?: NixChannel
}): Promise<PackageResult> {
  const registry = registrySchema.parse(input.registry)
  const name = input.name

  try {
    switch (registry) {
      case "npm": {
        const detail = await npmPackage({ data: name })
        return { record: detail.record, readmeHtml: detail.readmeHtml }
      }
      case "crates": {
        const detail = await cratesPackage({ data: name })
        return {
          record: detail.record,
          readmeHtml: detail.readmeHtml,
          versions: detail.record.versions,
        }
      }
      case "nix": {
        const result = await searchNix({
          data: { q: name, channel: input.channel },
        })
        if (!result.ok) {
          throw new UpstreamError(503, "nixpkgs search is unavailable")
        }
        const record = result.records.find(
          (candidate) => candidate.name === name
        )
        if (!record) {
          if (result.degraded) {
            throw new UpstreamError(
              502,
              "nixpkgs package metadata has an unsupported schema"
            )
          }
          return { notFound: true }
        }
        return { record, degraded: result.degraded }
      }
      default:
        throw new Error("unknown registry")
    }
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 404) {
      return { notFound: true }
    }
    throw error
  }
}

export const getPackage = createServerFn({ method: "GET" })
  .validator(
    z.object({
      registry: z.string(),
      name: z.string().min(1),
      channel: z.enum(NIX_CHANNELS).optional(),
    })
  )
  .handler(async ({ data }) => getPackageHandler(data))
