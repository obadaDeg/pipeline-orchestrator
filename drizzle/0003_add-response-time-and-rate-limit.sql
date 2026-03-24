ALTER TABLE "delivery_attempts" ADD COLUMN "response_time_ms" integer;--> statement-breakpoint
ALTER TABLE "pipelines" ADD COLUMN "rate_limit_per_minute" integer;--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_rate_limit_check" CHECK (rate_limit_per_minute IS NULL OR (rate_limit_per_minute >= 1 AND rate_limit_per_minute <= 1000));