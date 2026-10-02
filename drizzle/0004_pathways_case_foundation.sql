CREATE TYPE "public"."pathways_case_status" AS ENUM('NEW', 'CONTACT_RECEIVED', 'BOOKED', 'COMPLETED', 'NEEDS_INFORMATION', 'FOLLOW_UP', 'NOT_CURRENT_SERVICE_FIT', 'CLOSED');--> statement-breakpoint
CREATE TABLE "pathways_case" (
	"id" text PRIMARY KEY NOT NULL,
	"student_pathway_record_id" text NOT NULL,
	"consultation_request_id" text NOT NULL,
	"profile_revision_id" text NOT NULL,
	"report_snapshot_id" text NOT NULL,
	"booking_id" text,
	"status" "pathways_case_status" DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_pathway_record" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "advisor_assignment" ADD COLUMN "pathways_case_id" text;--> statement-breakpoint
ALTER TABLE "advisor_assignment" ADD COLUMN "assigned_by_user_id" text;--> statement-breakpoint
ALTER TABLE "audit_event" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "pathways_case" ADD CONSTRAINT "pathways_case_student_pathway_record_id_student_pathway_record_id_fk" FOREIGN KEY ("student_pathway_record_id") REFERENCES "public"."student_pathway_record"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pathways_case" ADD CONSTRAINT "pathways_case_consultation_request_id_consultation_request_id_fk" FOREIGN KEY ("consultation_request_id") REFERENCES "public"."consultation_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pathways_case" ADD CONSTRAINT "pathways_case_profile_revision_id_profile_revision_id_fk" FOREIGN KEY ("profile_revision_id") REFERENCES "public"."profile_revision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pathways_case" ADD CONSTRAINT "pathways_case_report_snapshot_id_report_snapshot_id_fk" FOREIGN KEY ("report_snapshot_id") REFERENCES "public"."report_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pathways_case" ADD CONSTRAINT "pathways_case_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pathways_case_consultation_request_unique_idx" ON "pathways_case" USING btree ("consultation_request_id");--> statement-breakpoint
CREATE INDEX "pathways_case_student_idx" ON "pathways_case" USING btree ("student_pathway_record_id");--> statement-breakpoint
CREATE INDEX "pathways_case_booking_idx" ON "pathways_case" USING btree ("booking_id");--> statement-breakpoint
ALTER TABLE "advisor_assignment" ADD CONSTRAINT "advisor_assignment_pathways_case_id_pathways_case_id_fk" FOREIGN KEY ("pathways_case_id") REFERENCES "public"."pathways_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_assignment" ADD CONSTRAINT "advisor_assignment_assigned_by_user_id_user_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advisor_assignment_pathways_case_idx" ON "advisor_assignment" USING btree ("pathways_case_id");