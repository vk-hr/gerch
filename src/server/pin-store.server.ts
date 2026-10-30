import type { Registry } from "@/server/registries/record"
import type { DatabaseSync } from "node:sqlite"

import { openDb } from "@/server/db.server"
import { z } from "zod"

const registrySchema = z.enum(["npm", "crates", "nix"])

export function createPinStore(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pins (
      registry TEXT NOT NULL,
      name TEXT NOT NULL,
      pinned_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (registry, name)
    )
  `)

  return {
    list(): { registry: Registry; name: string }[] {
      const rows = db
        .prepare("SELECT registry, name FROM pins ORDER BY pinned_at ASC")
        .all()
      return rows.map((row) => ({
        registry: registrySchema.parse(row.registry),
        name: row.name as string,
      }))
    },
    add(registry: Registry, name: string): void {
      db.prepare(
        "INSERT INTO pins (registry, name) VALUES (?, ?) ON CONFLICT DO NOTHING"
      ).run(registry, name)
    },
    remove(registry: Registry, name: string): void {
      db.prepare("DELETE FROM pins WHERE registry = ? AND name = ?").run(
        registry,
        name
      )
    },
  }
}

export const store = createPinStore(openDb())
