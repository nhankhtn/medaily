-- Drop the old OS-follow preference; themes are concrete palettes only.
UPDATE "user_settings" SET "theme" = 'light' WHERE "theme" = 'system';--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "theme" SET DEFAULT 'light';
