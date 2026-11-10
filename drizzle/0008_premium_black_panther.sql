CREATE TYPE "public"."family_decision" AS ENUM('CONTINUE_WITH_PATHWAYS', 'BLUEPRINT_ONLY', 'FOLLOW_UP_NEEDED', 'NOT_PROCEEDING');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('NOT_REQUIRED', 'TERMS_PENDING', 'TERMS_CONFIRMED', 'PAYMENT_HANDLED_EXTERNALLY');--> statement-breakpoint
CREATE TYPE "public"."payment_structure" AS ENUM('ONE_TIME', 'MONTHLY', 'INSTALLMENTS', 'CUSTOM', 'WAIVED', 'PENDING');--> statement-breakpoint
CREATE TYPE "public"."service_arrangement" AS ENUM('ONGOING_PATHWAYS_CONSULTING', 'CUSTOM_ENGAGEMENT');--> statement-breakpoint
CREATE TYPE "public"."service_engagement_status" AS ENUM('PENDING_DECISION', 'TERMS_PENDING', 'CONFIRMED', 'ACTIVE', 'DECLINED', 'CLOSED');--> statement-breakpoint
ALTER TYPE "public"."pathways_case_status" ADD VALUE 'ACTIVE_CONSULTANCY';--> statement-breakpoint
CREATE TABLE "service_engagement" (
	"id" text PRIMARY KEY NOT NULL,
	"pathways_case_id" text NOT NULL,
	"source_blueprint_revision_id" text NOT NULL,
	"family_decision" "family_decision" NOT NULL,
	"family_decision_recorded_at" timestamp with time zone NOT NULL,
	"family_decision_recorded_by_user_id" text NOT NULL,
	"service_arrangement" "service_arrangement",
	"service_arrangement_description" text,
	"payment_structure" "payment_structure",
	"payment_status" "payment_status",
	"currency" text DEFAULT 'USD' NOT NULL,
	"agreed_total_amount_cents" integer,
	"payment_amount_cents" integer,
	"installment_count" integer,
	"first_payment_date" timestamp with time zone,
	"terms_note" text,
	"payment_method_note" text,
	"payment_handled_externally" boolean DEFAULT false NOT NULL,
	"follow_up_note" text,
	"follow_up_date" timestamp with time zone,
	"not_proceeding_reason" text,
	"status" "service_engagement_status" DEFAULT 'PENDING_DECISION' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirmed_by_user_id" text,
	"activated_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_engagement" ADD CONSTRAINT "service_engagement_pathways_case_id_pathways_case_id_fk" FOREIGN KEY ("pathways_case_id") REFERENCES "public"."pathways_case"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_engagement" ADD CONSTRAINT "service_engagement_source_blueprint_revision_id_blueprint_revision_id_fk" FOREIGN KEY ("source_blueprint_revision_id") REFERENCES "public"."blueprint_revision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_engagement" ADD CONSTRAINT "service_engagement_family_decision_recorded_by_user_id_user_id_fk" FOREIGN KEY ("family_decision_recorded_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_engagement" ADD CONSTRAINT "service_engagement_confirmed_by_user_id_user_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_engagement_case_unique_idx" ON "service_engagement" USING btree ("pathways_case_id");--> statement-breakpoint
CREATE INDEX "service_engagement_blueprint_revision_idx" ON "service_engagement" USING btree ("source_blueprint_revision_id");