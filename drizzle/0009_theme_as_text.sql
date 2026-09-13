ALTER TABLE "user_settings" ALTER COLUMN "theme" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "theme" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "theme" SET DEFAULT 'system';--> statement-breakpoint
DROP TYPE "public"."theme";