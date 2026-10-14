ALTER TABLE "discovery_session" ADD COLUMN "draft_answers" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "discovery_session" ADD COLUMN "draft_question_bank_version" text;--> statement-breakpoint
ALTER TABLE "discovery_session" ADD COLUMN "draft_interest_hint" text;--> statement-breakpoint
ALTER TABLE "discovery_session" ADD COLUMN "draft_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profile_revision" ADD COLUMN "submission_idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_revision_session_idempotency_unique_idx" ON "profile_revision" USING btree ("discovery_session_id","submission_idempotency_key") WHERE "profile_revision"."submission_idempotency_key" IS NOT NULL;