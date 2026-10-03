ALTER TABLE "notifications" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "payload" jsonb;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
UPDATE "notifications" SET "kind" = 'legacy', "payload" = jsonb_build_object('title', "title", 'body', "body", 'url', "url"), "dedupe_key" = "tag";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "payload" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_tag_uniq";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "body";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "url";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "tag";--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_dedupe_uniq" UNIQUE("user_id","dedupe_key");