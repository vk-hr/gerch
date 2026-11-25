import { expect, test } from "@playwright/test"
import type { BrowserContext } from "@playwright/test"
import { z } from "zod"

import { firstResult, interactive } from "./support.ts"

interface Sent {
  name: string
  route: string
  body: string
}

const sampleSchema = z.object({ name: z.string(), route: z.string() })

// Every vitals beacon any page of the context sends.
function vitalsSent(context: BrowserContext): Sent[] {
  const sent: Sent[] = []
  context.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/api/vitals")) {
      const body = request.postData() ?? ""
      const { name, route } = sampleSchema.parse(JSON.parse(body))
      sent.push({ body, name, route })
    }
  })
  return sent
}

const names = (sent: readonly Sent[]) => sent.map((sample) => sample.name)

test("a page sends its vitals by route template, without the search text", async ({
  context,
  page,
}) => {
  const sent = vitalsSent(context)
  await interactive(page, "/?q=zod")
  await expect(firstResult(page, "npm")).toBeVisible()
  // TTFB and FCP go out as soon as the reporter starts.
  await expect
    .poll(() => names(sent))
    .toEqual(expect.arrayContaining(["FCP", "TTFB"]))
  // The first key press ends the LCP measurement, which sends it.
  await page.keyboard.press("/")
  await expect.poll(() => names(sent)).toContain("LCP")
  expect(new Set(sent.map((sample) => sample.route))).toStrictEqual(
    new Set(["/"])
  )
  expect(sent.filter((sample) => sample.body.includes("zod"))).toStrictEqual([])
})
