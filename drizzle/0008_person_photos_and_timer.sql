CREATE TYPE "public"."timer_mode" AS ENUM('stopwatch', 'countdown');--> statement-breakpoint
CREATE TYPE "public"."timer_target" AS ENUM('focus', 'workout');--> statement-breakpoint
CREATE TABLE "person_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"public_id" text NOT NULL,
	"format" text,
	"width" integer,
	"height" integer,
	"bytes" integer,
	"caption" text,
	"taken_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "person_photos_user_public_id_uniq" UNIQUE("user_id","public_id")
);
--> statement-breakpoint
ALTER TABLE "timer_state" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "timer_state" ADD COLUMN "accumulated_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "timer_state" ADD COLUMN "target" timer_target DEFAULT 'focus' NOT NULL;--> statement-breakpoint
ALTER TABLE "timer_state" ADD COLUMN "mode" timer_mode DEFAULT 'stopwatch' NOT NULL;--> statement-breakpoint
ALTER TABLE "timer_state" ADD COLUMN "target_seconds" integer;--> statement-breakpoint
ALTER TABLE "timer_state" ADD COLUMN "workout_type" text;--> statement-breakpoint
ALTER TABLE "person_photos" ADD CONSTRAINT "person_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_photos" ADD CONSTRAINT "person_photos_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_person_photos_person" ON "person_photos" USING btree ("person_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "timer_state" ADD CONSTRAINT "accumulated_non_negative" CHECK ("timer_state"."accumulated_seconds" >= 0);--> statement-breakpoint
ALTER TABLE "timer_state" ADD CONSTRAINT "target_seconds_range" CHECK ("timer_state"."target_seconds" IS NULL OR "timer_state"."target_seconds" BETWEEN 60 AND 86400);