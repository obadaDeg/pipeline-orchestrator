ALTER TABLE "jobs" ADD COLUMN "retry_count" integer NOT NULL DEFAULT 0;
ALTER TYPE "public"."audit_event_type" ADD VALUE 'JOB_RETRIED';
