CREATE TYPE "public"."consultation_call_format" AS ENUM('VIDEO', 'PHONE');--> statement-breakpoint
CREATE TABLE "consultation_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"consultation_request_id" text NOT NULL,
	"guardian_name" text NOT NULL,
	"email" text NOT NULL,
	"mobile_phone" text NOT NULL,
	"preferred_call_format" "consultation_call_format" DEFAULT 'VIDEO' NOT NULL,
	"contact_consent_version" text NOT NULL,
	"contact_consent_granted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consultation_request" ADD COLUMN "profile_revision_id" text;--> statement-breakpoint
ALTER TABLE "consultation_request" ADD COLUMN "report_snapshot_id" text;--> statement-breakpoint
ALTER TABLE "consultation_contact" ADD CONSTRAINT "consultation_contact_consultation_request_id_consultation_request_id_fk" FOREIGN KEY ("consultation_request_id") REFERENCES "public"."consultation_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consultation_contact_request_unique_idx" ON "consultation_contact" USING btree ("consultation_request_id");--> statement-breakpoint
ALTER TABLE "consultation_request" ADD CONSTRAINT "consultation_request_profile_revision_id_profile_revision_id_fk" FOREIGN KEY ("profile_revision_id") REFERENCES "public"."profile_revision"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_request" ADD CONSTRAINT "consultation_request_report_snapshot_id_report_snapshot_id_fk" FOREIGN KEY ("report_snapshot_id") REFERENCES "public"."report_snapshot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "engine_run_idempotency_unique_idx" ON "engine_run" USING btree ("profile_revision_id","rules_version","taxonomy_version","scoring_policy_version","content_version");--> statement-breakpoint
CREATE UNIQUE INDEX "report_snapshot_idempotency_unique_idx" ON "report_snapshot" USING btree ("profile_revision_id","content_hash");--> statement-breakpoint
CREATE INDEX "consultation_request_profile_revision_idx" ON "consultation_request" USING btree ("profile_revision_id");--> statement-breakpoint
CREATE INDEX "consultation_request_report_snapshot_idx" ON "consultation_request" USING btree ("report_snapshot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "consultation_request_profile_revision_unique_idx" ON "consultation_request" USING btree ("profile_revision_id");