ALTER TABLE "cache_entries" ADD COLUMN "refresh_error" text;--> statement-breakpoint
ALTER TABLE "cache_entries" ADD COLUMN "refresh_failed_at" bigint;