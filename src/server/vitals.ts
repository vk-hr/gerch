// POST /api/vitals: one web-vitals sample per request (D18). Samples keep a
// route template, the release, and an allow-list of attribution fields, so
// no URL or search text is stored.
import { desc, lt, sql } from "drizzle-orm"
import { z } from "zod"

import {
  ATTRIBUTION_KEYS,
  ROUTE_TEMPLATES,
  VITAL_NAMES,
} from "@/shared/vitals.ts"
import type { VitalSample } from "@/shared/vitals.ts"

import type { Database } from "./db/index.ts"
import { vitals } from "./db/schema.ts"

const MAX_BODY_BYTES = 4096
const MAX_TEXT = 200
const NO_CONTENT = 204
const BAD_REQUEST = 400
const TOO_LARGE = 413
const HEADERS = { "cache-control": "no-store" }

interface StoredVital extends VitalSample {
  release: string
}

interface VitalStore {
  record: (vital: StoredVital) => Promise<void>
}

const sampleSchema = z.object({
  attribution: z.record(z.string(), z.unknown()),
  name: z.enum(VITAL_NAMES),
  navigationType: z.string().max(MAX_TEXT),
  rating: z.enum(["good", "needs-improvement", "poor"]),
  route: z.enum(ROUTE_TEMPLATES),
  value: z.number().nonnegative(),
})
const fieldSchema = z.union([z.number(), z.string().max(MAX_TEXT)])

// Only the allowed fields of the metric, and only numbers and short text.
function keptAttribution(
  name: VitalSample["name"],
  attribution: Record<string, unknown>
): Record<string, string | number> {
  return Object.fromEntries(
    ATTRIBUTION_KEYS[name].flatMap((key) => {
      const field = fieldSchema.safeParse(attribution[key])
      return field.success ? [[key, field.data]] : []
    })
  )
}

function parseSample(text: string): VitalSample | null {
  try {
    const parsed = sampleSchema.safeParse(JSON.parse(text))
    return parsed.success
      ? {
          ...parsed.data,
          attribution: keptAttribution(
            parsed.data.name,
            parsed.data.attribution
          ),
        }
      : null
  } catch {
    return null
  }
}

async function handleVitals(
  request: Request,
  deps: { release: string; store: VitalStore | null }
): Promise<Response> {
  const declared = Number(request.headers.get("content-length") ?? "0")
  const text = declared > MAX_BODY_BYTES ? null : await request.text()
  if (text === null || new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return new Response(null, { headers: HEADERS, status: TOO_LARGE })
  }
  const sample = parseSample(text)
  if (sample === null) {
    return new Response(null, { headers: HEADERS, status: BAD_REQUEST })
  }
  await deps.store?.record({ ...sample, release: deps.release })
  return new Response(null, { headers: HEADERS, status: NO_CONTENT })
}

function postgresVitals(db: Database) {
  return {
    recent: async (limit: number) =>
      db.select().from(vitals).orderBy(desc(vitals.id)).limit(limit),
    record: async (vital: StoredVital) => {
      await db.insert(vitals).values(vital)
    },
  }
}

// Samples are kept for 30 days; the scheduled workflow prunes the rest.
const KEEP_DAYS = 30

async function pruneVitals(db: Database): Promise<number> {
  const removed = await db
    .delete(vitals)
    .where(
      lt(vitals.createdAt, sql`now() - make_interval(days => ${KEEP_DAYS})`)
    )
    .returning({ id: vitals.id })
  return removed.length
}

export { handleVitals, postgresVitals, pruneVitals }
export type { StoredVital, VitalStore }
