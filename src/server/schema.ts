import { z } from "zod"

import { REGISTRIES } from "@/shared/registry.ts"
import type { PackageSummary } from "@/shared/registry.ts"

const httpUrl = z.url({ protocol: /^https?$/u })

const packageSummarySchema = z.strictObject({
  description: z.string().nullable(),
  downloads: z
    .strictObject({
      count: z.int().nonnegative(),
      window: z.enum(["week", "90d"]),
    })
    .nullable(),
  homepage: httpUrl.nullable(),
  install: z.string().min(1),
  license: z.string().min(1).nullable(),
  name: z.string().min(1),
  registry: z.enum(REGISTRIES),
  releasedAt: z.iso.datetime({ offset: true }).nullable(),
  repository: httpUrl.nullable(),
  version: z.string().min(1),
}) satisfies z.ZodType<PackageSummary>

const packageSummariesSchema = z.array(packageSummarySchema)

export { packageSummariesSchema, packageSummarySchema }
