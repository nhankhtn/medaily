-- `v_daily_effective` was created from `daily_logs.*`, so Postgres recorded
-- `is_demo` as one of its columns and refuses to drop the column while the view
-- exists. drizzle/views.sql recreates the view immediately after migrations run.
DROP VIEW IF EXISTS "v_daily_effective";--> statement-breakpoint
ALTER TABLE "daily_logs" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "habits" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "focus_sessions" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "topics" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "body_measurements" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "nutrition_logs" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "workouts" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "assets" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "budgets" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "finance_categories" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "investments" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "recurring_transactions" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "journal_entries" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "notes" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "planned_blocks" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "interactions" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "people" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "reminders" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "achievements" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "portfolio_items" DROP COLUMN "is_demo";--> statement-breakpoint
ALTER TABLE "skills" DROP COLUMN "is_demo";