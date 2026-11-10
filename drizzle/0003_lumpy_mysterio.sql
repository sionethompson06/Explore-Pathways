CREATE TYPE "public"."booking_source" AS ENUM('INTERNAL', 'EXTERNAL');--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "source" "booking_source" DEFAULT 'EXTERNAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "resource_key" text;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "booker_time_zone" text;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_active_per_request_unique_idx" ON "booking" USING btree ("consultation_request_id") WHERE "booking"."cancelled_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "booking_resource_slot_unique_idx" ON "booking" USING btree ("resource_key","scheduled_at") WHERE "booking"."resource_key" IS NOT NULL AND "booking"."scheduled_at" IS NOT NULL AND "booking"."cancelled_at" IS NULL;