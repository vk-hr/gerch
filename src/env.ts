import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  /**
   * Server-only variables. Never bundled for the browser.
   * Schemas validate at import time on the server.
   */
  server: {
    // Example — validated only when set. Replace with real vars as needed.
    EXAMPLE_SERVER_SECRET: z.string().min(32).optional(),
  },

  /**
   * Client variables must be prefixed with VITE_ so Vite
   * statically inlines (and only inlines) these into the bundle.
   */
  clientPrefix: "VITE_",
  client: {
    // Example — validated only when set. Replace with real vars as needed.
    VITE_APP_URL: z.url().optional(),
  },

  /**
   * Vite exposes all resolved env vars via import.meta.env during SSR;
   * client access is gated by the VITE_ prefix above.
   */
  runtimeEnv: import.meta.env,

  /**
   * Treat empty-string vars as unset instead of a validation error.
   */
  emptyStringAsUndefined: true,

  /**
   * Escape hatch for e.g. docker builds that don't have runtime env:
   * set SKIP_ENV_VALIDATION=1 to bypass validation entirely.
   */
  skipValidation: !!import.meta.env.SKIP_ENV_VALIDATION,
})
