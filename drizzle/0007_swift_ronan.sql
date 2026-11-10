CREATE TYPE "public"."blueprint_revision_reason" AS ENUM('FAMILY_UPDATE', 'NEW_VERIFICATION', 'EDUCATIONAL_PLAN_CHANGE', 'CORRECTION', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."blueprint_revision_status" AS ENUM('DRAFT', 'INTERNAL_REVIEW', 'READY_FOR_CLIENT', 'SUPERSEDED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "blueprint_revision" (
	"id" text PRIMARY KEY NOT NULL,
	"blueprint_id" text NOT NULL,
	"revision_number" integer NOT NULL,
	"status" "blueprint_revision_status" DEFAULT 'DRAFT' NOT NULL,
	"is_current" boolean DEFAULT true NOT NULL,
	"authoring_advisor_user_id" text NOT NULL,
	"last_edited_by_user_id" text,
	"content_schema_version" text NOT NULL,
	"content" jsonb NOT NULL,
	"source_profile_revision_id" text NOT NULL,
	"source_report_snapshot_id" text NOT NULL,
	"source_planning_call_record_id" text NOT NULL,
	"source_planning_call_record_version" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"revision_reason" "blueprint_revision_reason",
	"revision_reason_other" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_for_client_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "student_success_blueprint" (
	"id" text PRIMARY KEY NOT NULL,
	"pathways_case_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blueprint_revision" ADD CONSTRAINT "blueprint_revision_blueprint_id_student_success_blueprint_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."student_success_blueprint"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_revision" ADD CONSTRAINT "blueprint_revision_authoring_advisor_user_id_user_id_fk" FOREIGN KEY ("authoring_advisor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_revision" ADD CONSTRAINT "blueprint_revision_last_edited_by_user_id_user_id_fk" FOREIGN KEY ("last_edited_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_revision" ADD CONSTRAINT "blueprint_revision_source_profile_revision_id_profile_revision_id_fk" FOREIGN KEY ("source_profile_revision_id") REFERENCES "public"."profile_revision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_revision" ADD CONSTRAINT "blueprint_revision_source_report_snapshot_id_report_snapshot_id_fk" FOREIGN KEY ("source_report_snapshot_id") REFERENCES "public"."report_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blueprint_revision" ADD CONSTRAINT "blueprint_revision_source_planning_call_record_id_planning_call_record_id_fk" FOREIGN KEY ("source_planning_call_record_id") REFERENCES "public"."planning_call_record"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_success_blueprint" ADD CONSTRAINT "student_success_blueprint_pathways_case_id_pathways_case_id_fk" FOREIGN KEY ("pathways_case_id") REFERENCES "public"."pathways_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blueprint_revision_blueprint_idx" ON "blueprint_revision" USING btree ("blueprint_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blueprint_revision_number_unique_idx" ON "blueprint_revision" USING btree ("blueprint_id","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "blueprint_revision_current_per_blueprint_unique_idx" ON "blueprint_revision" USING btree ("blueprint_id") WHERE "blueprint_revision"."is_current" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "student_success_blueprint_case_unique_idx" ON "student_success_blueprint" USING btree ("pathways_case_id");