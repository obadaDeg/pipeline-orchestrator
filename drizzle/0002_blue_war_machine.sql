ALTER TYPE "public"."audit_event_type" ADD VALUE 'SIGNATURE_FAILED';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pipeline_signing_secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"secret_value" text NOT NULL,
	"secret_hint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pipeline_signing_secrets" ADD CONSTRAINT "pipeline_signing_secrets_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_pipeline_signing_secrets_pipeline_id" ON "pipeline_signing_secrets" ("pipeline_id");
