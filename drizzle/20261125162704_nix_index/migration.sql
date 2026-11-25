CREATE TABLE "nix_index" (
	"channel" text PRIMARY KEY,
	"etag" text,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"packages" integer NOT NULL,
	"release" text
);
--> statement-breakpoint
CREATE TABLE "nix_packages" (
	"attr" text PRIMARY KEY,
	"description" text,
	"homepage" text,
	"license" text,
	"main_program" text,
	"name_words" tsvector GENERATED ALWAYS AS (to_tsvector('simple', regexp_replace(attr || ' ' || pname || ' ' || coalesce(main_program, ''), '[^[:alnum:]]+', ' ', 'g'))) STORED,
	"pname" text NOT NULL,
	"text_words" tsvector GENERATED ALWAYS AS (to_tsvector('simple', regexp_replace(attr || ' ' || pname || ' ' || coalesce(main_program, '') || ' ' || coalesce(description, ''), '[^[:alnum:]]+', ' ', 'g'))) STORED,
	"version" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "nix_packages_text_words" ON "nix_packages" USING gin ("text_words");