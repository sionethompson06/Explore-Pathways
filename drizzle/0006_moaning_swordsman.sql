CREATE TYPE "public"."planning_call_attendance" AS ENUM('ATTENDED', 'NO_SHOW', 'CANCELLED', 'RESCHEDULE_NEEDED');--> statement-breakpoint
CREATE TYPE "public"."planning_call_outcome" AS ENUM('CONTINUE_TO_BLUEPRINT', 'NEEDS_INFORMATION', 'FOLLOW_UP', 'NOT_CURRENT_SERVICE_FIT', 'FAMILY_NOT_PROCEEDING');--> statement-breakpoint
CREATE TYPE "public"."planning_call_record_status" AS ENUM('DRAFT', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."planning_call_service_fit" AS ENUM('GOOD_FIT', 'POSSIBLE_FIT', 'NOT_CURRENT_FIT', 'UNDETERMINED');--> statement-breakpoint
ALTER TYPE "public"."pathways_case_status" ADD VALUE 'FAMILY_NOT_PROCEEDING';--> statement-breakpoint
CREATE TABLE "planning_call_record" (
	"id" text PRIMARY KEY NOT NULL,
	"pathways_case_id" text NOT NULL,
	"consultation_request_id" text NOT NULL,
	"booking_id" text,
	"profile_revision_id" text NOT NULL,
	"report_snapshot_id" text NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"status" "planning_call_record_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by_advisor_user_id" text NOT NULL,
	"last_edited_by_user_id" text,
	"family_main_goal" text,
	"current_educational_situation" text,
	"student_strengths" text,
	"learning_needs_support" text,
	"schedule_lifestyle_requirements" text,
	"academic_planning_notes" text,
	"pathways_discussed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"advisor_assessment" text,
	"recommended_next_action" text,
	"primary_goal_confirmed" boolean,
	"current_model_confirmed" boolean,
	"priority_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verification_needed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verified_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"service_fit" "planning_call_service_fit",
	"follow_up_required" boolean,
	"attendance" "planning_call_attendance",
	"attendance_recorded_at" timestamp with time zone,
	"outcome" "planning_call_outcome",
	"outcome_recorded_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "planning_call_record" ADD CONSTRAINT "planning_call_record_pathways_case_id_pathways_case_id_fk" FOREIGN KEY ("pathways_case_id") REFERENCES "public"."pathways_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_call_record" ADD CONSTRAINT "planning_call_record_consultation_request_id_consultation_request_id_fk" FOREIGN KEY ("consultation_request_id") REFERENCES "public"."consultation_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_call_record" ADD CONSTRAINT "planning_call_record_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_call_record" ADD CONSTRAINT "planning_call_record_profile_revision_id_profile_revision_id_fk" FOREIGN KEY ("profile_revision_id") REFERENCES "public"."profile_revision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_call_record" ADD CONSTRAINT "planning_call_record_report_snapshot_id_report_snapshot_id_fk" FOREIGN KEY ("report_snapshot_id") REFERENCES "public"."report_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_call_record" ADD CONSTRAINT "planning_call_record_created_by_advisor_user_id_user_id_fk" FOREIGN KEY ("created_by_advisor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_call_record" ADD CONSTRAINT "planning_call_record_last_edited_by_user_id_user_id_fk" FOREIGN KEY ("last_edited_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planning_call_record_case_idx" ON "planning_call_record" USING btree ("pathways_case_id");--> statement-breakpoint
CREATE INDEX "planning_call_record_consultation_request_idx" ON "planning_call_record" USING btree ("consultation_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_call_record_primary_per_case_unique_idx" ON "planning_call_record" USING btree ("pathways_case_id") WHERE "planning_call_record"."is_primary" = true;