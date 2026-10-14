CREATE TYPE "public"."staff_role_type" AS ENUM('ADVISOR', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."report_content_status" AS ENUM('PERSONALIZED', 'LIMITED_INFORMATION', 'ADVISOR_FIRST');--> statement-breakpoint
CREATE TYPE "public"."report_generation_state" AS ENUM('TEMPLATE', 'AI_ASSISTED', 'FALLBACK', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."consent_action" AS ENUM('GRANTED', 'REVOKED');--> statement-breakpoint
CREATE TYPE "public"."consent_purpose" AS ENUM('EMAIL_DELIVERY', 'EMAIL_MARKETING', 'SMS');--> statement-breakpoint
CREATE TYPE "public"."consultation_status" AS ENUM('NONE', 'REQUESTED', 'PENDING_VERIFICATION', 'BOOKED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."consultation_timeline" AS ENUM('READY_NOW', 'PLANNING', 'EXPLORING', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."actor_type" AS ENUM('GUEST', 'GUARDIAN', 'ADVISOR', 'ADMIN', 'SYSTEM');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"account_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_role" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" "staff_role_type" NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by_user_id" text,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "discovery_session" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"student_pathway_record_id" text,
	"claimed_by_guardian_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engine_run" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_revision_id" text NOT NULL,
	"effective_profile_hash" text NOT NULL,
	"triggered_rule_ids" jsonb NOT NULL,
	"positive_groups_by_model" jsonb NOT NULL,
	"scoped_review_signals" jsonb NOT NULL,
	"contributions" jsonb NOT NULL,
	"internal_sort_score_by_model" jsonb NOT NULL,
	"excluded_candidates" jsonb NOT NULL,
	"display_gate_reasons" jsonb NOT NULL,
	"rules_version" text NOT NULL,
	"taxonomy_version" text NOT NULL,
	"scoring_policy_version" text NOT NULL,
	"content_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardian_student_access" (
	"id" text PRIMARY KEY NOT NULL,
	"guardian_user_id" text NOT NULL,
	"student_pathway_record_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "profile_revision" (
	"id" text PRIMARY KEY NOT NULL,
	"student_pathway_record_id" text NOT NULL,
	"discovery_session_id" text,
	"revision_number" integer NOT NULL,
	"raw_answers" jsonb NOT NULL,
	"effective_answers" jsonb NOT NULL,
	"grade_band" text,
	"question_bank_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"engine_run_id" text NOT NULL,
	"profile_revision_id" text NOT NULL,
	"content_status" "report_content_status" NOT NULL,
	"generation_state" "report_generation_state" NOT NULL,
	"public_content" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_pathway_record" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "advisor_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"consultation_request_id" text NOT NULL,
	"advisor_user_id" text NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unassigned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "advisor_note" (
	"id" text PRIMARY KEY NOT NULL,
	"consultation_request_id" text NOT NULL,
	"advisor_user_id" text NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking" (
	"id" text PRIMARY KEY NOT NULL,
	"consultation_request_id" text NOT NULL,
	"provider_reference" text,
	"scheduled_at" timestamp with time zone,
	"time_zone" text,
	"cancelled_at" timestamp with time zone,
	"rescheduled_from_booking_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_event" (
	"id" text PRIMARY KEY NOT NULL,
	"guardian_user_id" text NOT NULL,
	"purpose" "consent_purpose" NOT NULL,
	"action" "consent_action" NOT NULL,
	"version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_request" (
	"id" text PRIMARY KEY NOT NULL,
	"student_pathway_record_id" text NOT NULL,
	"guardian_user_id" text,
	"status" "consultation_status" DEFAULT 'NONE' NOT NULL,
	"timeline" "consultation_timeline" DEFAULT 'UNKNOWN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_event" (
	"id" text PRIMARY KEY NOT NULL,
	"consultation_request_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aggregate_event" (
	"id" text PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"properties" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_event" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"actor_type" "actor_type" NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role" ADD CONSTRAINT "staff_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_role" ADD CONSTRAINT "staff_role_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_session" ADD CONSTRAINT "discovery_session_student_pathway_record_id_student_pathway_record_id_fk" FOREIGN KEY ("student_pathway_record_id") REFERENCES "public"."student_pathway_record"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_session" ADD CONSTRAINT "discovery_session_claimed_by_guardian_user_id_user_id_fk" FOREIGN KEY ("claimed_by_guardian_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engine_run" ADD CONSTRAINT "engine_run_profile_revision_id_profile_revision_id_fk" FOREIGN KEY ("profile_revision_id") REFERENCES "public"."profile_revision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_student_access" ADD CONSTRAINT "guardian_student_access_guardian_user_id_user_id_fk" FOREIGN KEY ("guardian_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_student_access" ADD CONSTRAINT "guardian_student_access_student_pathway_record_id_student_pathway_record_id_fk" FOREIGN KEY ("student_pathway_record_id") REFERENCES "public"."student_pathway_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_revision" ADD CONSTRAINT "profile_revision_student_pathway_record_id_student_pathway_record_id_fk" FOREIGN KEY ("student_pathway_record_id") REFERENCES "public"."student_pathway_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_revision" ADD CONSTRAINT "profile_revision_discovery_session_id_discovery_session_id_fk" FOREIGN KEY ("discovery_session_id") REFERENCES "public"."discovery_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_snapshot" ADD CONSTRAINT "report_snapshot_engine_run_id_engine_run_id_fk" FOREIGN KEY ("engine_run_id") REFERENCES "public"."engine_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_snapshot" ADD CONSTRAINT "report_snapshot_profile_revision_id_profile_revision_id_fk" FOREIGN KEY ("profile_revision_id") REFERENCES "public"."profile_revision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_assignment" ADD CONSTRAINT "advisor_assignment_consultation_request_id_consultation_request_id_fk" FOREIGN KEY ("consultation_request_id") REFERENCES "public"."consultation_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_assignment" ADD CONSTRAINT "advisor_assignment_advisor_user_id_user_id_fk" FOREIGN KEY ("advisor_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_note" ADD CONSTRAINT "advisor_note_consultation_request_id_consultation_request_id_fk" FOREIGN KEY ("consultation_request_id") REFERENCES "public"."consultation_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_note" ADD CONSTRAINT "advisor_note_advisor_user_id_user_id_fk" FOREIGN KEY ("advisor_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking" ADD CONSTRAINT "booking_consultation_request_id_consultation_request_id_fk" FOREIGN KEY ("consultation_request_id") REFERENCES "public"."consultation_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_event" ADD CONSTRAINT "consent_event_guardian_user_id_user_id_fk" FOREIGN KEY ("guardian_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_request" ADD CONSTRAINT "consultation_request_student_pathway_record_id_student_pathway_record_id_fk" FOREIGN KEY ("student_pathway_record_id") REFERENCES "public"."student_pathway_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_request" ADD CONSTRAINT "consultation_request_guardian_user_id_user_id_fk" FOREIGN KEY ("guardian_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_event" ADD CONSTRAINT "workflow_event_consultation_request_id_consultation_request_id_fk" FOREIGN KEY ("consultation_request_id") REFERENCES "public"."consultation_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_event" ADD CONSTRAINT "workflow_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_unique_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_role_user_unique_idx" ON "staff_role" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_session_token_hash_unique_idx" ON "discovery_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "engine_run_profile_revision_idx" ON "engine_run" USING btree ("profile_revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guardian_student_access_unique_idx" ON "guardian_student_access" USING btree ("guardian_user_id","student_pathway_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_revision_record_revision_unique_idx" ON "profile_revision" USING btree ("student_pathway_record_id","revision_number");--> statement-breakpoint
CREATE INDEX "profile_revision_record_idx" ON "profile_revision" USING btree ("student_pathway_record_id");--> statement-breakpoint
CREATE INDEX "report_snapshot_profile_revision_idx" ON "report_snapshot" USING btree ("profile_revision_id");--> statement-breakpoint
CREATE INDEX "advisor_assignment_consultation_request_idx" ON "advisor_assignment" USING btree ("consultation_request_id");--> statement-breakpoint
CREATE INDEX "advisor_assignment_advisor_idx" ON "advisor_assignment" USING btree ("advisor_user_id");--> statement-breakpoint
CREATE INDEX "advisor_note_consultation_request_idx" ON "advisor_note" USING btree ("consultation_request_id");--> statement-breakpoint
CREATE INDEX "booking_consultation_request_idx" ON "booking" USING btree ("consultation_request_id");--> statement-breakpoint
CREATE INDEX "consent_event_guardian_idx" ON "consent_event" USING btree ("guardian_user_id");--> statement-breakpoint
CREATE INDEX "consultation_request_student_idx" ON "consultation_request" USING btree ("student_pathway_record_id");--> statement-breakpoint
CREATE INDEX "workflow_event_consultation_request_idx" ON "workflow_event" USING btree ("consultation_request_id");--> statement-breakpoint
CREATE INDEX "aggregate_event_name_idx" ON "aggregate_event" USING btree ("event_name");--> statement-breakpoint
CREATE INDEX "audit_event_target_idx" ON "audit_event" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_event_actor_idx" ON "audit_event" USING btree ("actor_user_id");