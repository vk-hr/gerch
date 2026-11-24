CREATE TABLE "cache_entries" (
	"fresh_until" bigint NOT NULL,
	"key" text PRIMARY KEY,
	"stale_until" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"value" jsonb NOT NULL
);
