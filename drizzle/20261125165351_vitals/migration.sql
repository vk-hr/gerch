CREATE TABLE "vitals" (
	"attribution" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vitals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"navigation_type" text NOT NULL,
	"rating" text NOT NULL,
	"release" text NOT NULL,
	"route" text NOT NULL,
	"value" double precision NOT NULL
);
