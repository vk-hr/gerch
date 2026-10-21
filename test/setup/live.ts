if (import.meta.env.SKIP_ENV_VALIDATION) {
  throw new Error("SKIP_ENV_VALIDATION must not be set for the live suite")
}
