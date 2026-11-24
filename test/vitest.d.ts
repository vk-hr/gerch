// Bun runs test files that import "vitest" against bun:test, so the types
// come from bun:test too. Vitest itself is not installed.
declare module "vitest" {
  export * from "bun:test"
}
