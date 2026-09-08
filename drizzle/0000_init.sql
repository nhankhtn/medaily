CREATE TYPE "public"."custom_metric_type" AS ENUM('number', 'boolean', 'scale', 'text');--> statement-breakpoint
CREATE TYPE "public"."focus_kind" AS ENUM('learning', 'deep_work', 'project');--> statement-breakpoint
CREATE TYPE "public"."focus_source" AS ENUM('timer', 'manual');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'completed', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."habit_frequency" AS ENUM('daily', 'weekly', 'specific_days', 'interval');--> statement-breakpoint
CREATE TYPE "public"."habit_operator" AS ENUM('gte', 'lte', 'eq');--> statement-breakpoint
CREATE TYPE "public"."insight_severity" AS ENUM('low', 'medium', 'high', 'win');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'vi');--> statement-breakpoint
CREATE TYPE "public"."log_source" AS ENUM('manual', 'catch_up', 'import', 'derived');--> statement-breakpoint
CREATE TYPE "public"."metric_aggregation" AS ENUM('sum', 'avg', 'count_days', 'latest');--> statement-breakpoint
CREATE TYPE "public"."metric_direction" AS ENUM('at_least', 'at_most');--> statement-breakpoint
CREATE TYPE "public"."metric_period" AS ENUM('total', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."progress_mode" AS ENUM('manual', 'metric', 'milestones');--> statement-breakpoint
CREATE TYPE "public"."recurrence" AS ENUM('weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TYPE "public"."unit_system" AS ENUM('metric', 'imperial');--> statement-breakpoint
CREATE TYPE "public"."week_start" AS ENUM('monday', 'sunday');--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"timezone" text DEFAULT 'Asia/Ho_Chi_Minh' NOT NULL,
	"day_rollover_hour" smallint DEFAULT 4 NOT NULL,
	"week_start" "week_start" DEFAULT 'monday' NOT NULL,
	"theme" "theme" DEFAULT 'system' NOT NULL,
	"density" text DEFAULT 'comfortable' NOT NULL,
	"accent" text DEFAULT 'indigo' NOT NULL,
	"unit_system" "unit_system" DEFAULT 'metric' NOT NULL,
	"default_currency" text DEFAULT 'VND' NOT NULL,
	"score_weights" jsonb,
	"score_targets" jsonb,
	"streak_thresholds" jsonb,
	"streak_grace_enabled" boolean DEFAULT true NOT NULL,
	"insight_thresholds" jsonb,
	"reminder_time" time DEFAULT '21:00' NOT NULL,
	"notification_prefs" jsonb,
	"dashboard_cards" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text DEFAULT 'Me' NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_metric_values" (
	"daily_log_id" uuid NOT NULL,
	"custom_metric_id" uuid NOT NULL,
	"value_numeric" numeric,
	"value_bool" boolean,
	"value_text" text,
	CONSTRAINT "custom_metric_values_daily_log_id_custom_metric_id_pk" PRIMARY KEY("daily_log_id","custom_metric_id"),
	CONSTRAINT "exactly_one_value" CHECK ((CASE WHEN "custom_metric_values"."value_numeric" IS NULL THEN 0 ELSE 1 END
         + CASE WHEN "custom_metric_values"."value_bool" IS NULL THEN 0 ELSE 1 END
         + CASE WHEN "custom_metric_values"."value_text" IS NULL THEN 0 ELSE 1 END) = 1)
);
--> statement-breakpoint
CREATE TABLE "custom_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label_en" text NOT NULL,
	"label_vi" text NOT NULL,
	"type" "custom_metric_type" DEFAULT 'number' NOT NULL,
	"unit" text,
	"min" numeric,
	"max" numeric,
	"aggregation" "metric_aggregation" DEFAULT 'sum' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_metrics_user_key_uniq" UNIQUE("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "daily_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"log_date" date NOT NULL,
	"energy" smallint,
	"mood" smallint,
	"sleep_hours" numeric(3, 1),
	"bedtime" time,
	"wake_time" time,
	"technical_study_minutes" smallint,
	"deep_work_minutes" smallint,
	"exercise_minutes" smallint,
	"exercise_type" text,
	"reading_minutes" smallint,
	"reading_pages" smallint,
	"entertainment_minutes" smallint,
	"english_minutes" smallint,
	"daily_win" text,
	"daily_problem" text,
	"tomorrow_priority" text,
	"note" text,
	"source" "log_source" DEFAULT 'manual' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_logs_user_date_uniq" UNIQUE("user_id","log_date"),
	CONSTRAINT "energy_range" CHECK ("daily_logs"."energy" IS NULL OR "daily_logs"."energy" BETWEEN 1 AND 10),
	CONSTRAINT "mood_range" CHECK ("daily_logs"."mood" IS NULL OR "daily_logs"."mood" BETWEEN 1 AND 10),
	CONSTRAINT "sleep_range" CHECK ("daily_logs"."sleep_hours" IS NULL OR "daily_logs"."sleep_hours" BETWEEN 0 AND 24),
	CONSTRAINT "study_range" CHECK ("daily_logs"."technical_study_minutes" IS NULL OR "daily_logs"."technical_study_minutes" BETWEEN 0 AND 1440),
	CONSTRAINT "deep_work_range" CHECK ("daily_logs"."deep_work_minutes" IS NULL OR "daily_logs"."deep_work_minutes" BETWEEN 0 AND 1440),
	CONSTRAINT "exercise_range" CHECK ("daily_logs"."exercise_minutes" IS NULL OR "daily_logs"."exercise_minutes" BETWEEN 0 AND 1440),
	CONSTRAINT "reading_range" CHECK ("daily_logs"."reading_minutes" IS NULL OR "daily_logs"."reading_minutes" BETWEEN 0 AND 1440),
	CONSTRAINT "entertainment_range" CHECK ("daily_logs"."entertainment_minutes" IS NULL OR "daily_logs"."entertainment_minutes" BETWEEN 0 AND 1440),
	CONSTRAINT "english_range" CHECK ("daily_logs"."english_minutes" IS NULL OR "daily_logs"."english_minutes" BETWEEN 0 AND 1440),
	CONSTRAINT "reading_pages_range" CHECK ("daily_logs"."reading_pages" IS NULL OR "daily_logs"."reading_pages" >= 0),
	CONSTRAINT "no_future_log" CHECK ("daily_logs"."log_date" <= CURRENT_DATE + 1)
);
--> statement-breakpoint
CREATE TABLE "habit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"habit_id" uuid NOT NULL,
	"log_date" date NOT NULL,
	"count" smallint DEFAULT 1 NOT NULL,
	"completed" boolean DEFAULT true NOT NULL,
	"source" "log_source" DEFAULT 'manual' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habit_logs_habit_date_uniq" UNIQUE("habit_id","log_date"),
	CONSTRAINT "count_non_negative" CHECK ("habit_logs"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'life' NOT NULL,
	"icon" text,
	"color" text,
	"frequency_type" "habit_frequency" DEFAULT 'daily' NOT NULL,
	"target_count" smallint DEFAULT 1 NOT NULL,
	"weekdays" smallint[],
	"interval_days" smallint,
	"linked_metric" text,
	"linked_operator" "habit_operator",
	"linked_threshold" numeric,
	"start_date" date NOT NULL,
	"end_date" date,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "target_count_positive" CHECK ("habits"."target_count" >= 1),
	CONSTRAINT "interval_days_valid" CHECK ("habits"."frequency_type" <> 'interval' OR ("habits"."interval_days" IS NOT NULL AND "habits"."interval_days" >= 1)),
	CONSTRAINT "weekdays_valid" CHECK ("habits"."frequency_type" <> 'specific_days' OR ("habits"."weekdays" IS NOT NULL AND array_length("habits"."weekdays", 1) >= 1)),
	CONSTRAINT "link_complete" CHECK ("habits"."linked_metric" IS NULL OR ("habits"."linked_operator" IS NOT NULL AND "habits"."linked_threshold" IS NOT NULL)),
	CONSTRAINT "dates_ordered" CHECK ("habits"."end_date" IS NULL OR "habits"."end_date" >= "habits"."start_date")
);
--> statement-breakpoint
CREATE TABLE "goal_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"title" text NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"weight" numeric DEFAULT '1' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weight_positive" CHECK ("goal_milestones"."weight" > 0)
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'life' NOT NULL,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"start_date" date NOT NULL,
	"target_date" date,
	"progress_mode" "progress_mode" DEFAULT 'manual' NOT NULL,
	"progress_manual" numeric(5, 2),
	"progress_updated_at" timestamp with time zone,
	"metric_key" text,
	"metric_aggregation" "metric_aggregation",
	"metric_period" "metric_period",
	"metric_target" numeric,
	"metric_direction" "metric_direction" DEFAULT 'at_least',
	"recurrence" "recurrence",
	"notes" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_progress_range" CHECK ("goals"."progress_manual" IS NULL OR "goals"."progress_manual" BETWEEN 0 AND 100),
	CONSTRAINT "metric_mode_complete" CHECK ("goals"."progress_mode" <> 'metric' OR ("goals"."metric_key" IS NOT NULL
        AND "goals"."metric_aggregation" IS NOT NULL
        AND "goals"."metric_period" IS NOT NULL
        AND "goals"."metric_target" IS NOT NULL
        AND "goals"."metric_target" > 0)),
	CONSTRAINT "goal_dates_ordered" CHECK ("goals"."target_date" IS NULL OR "goals"."target_date" >= "goals"."start_date")
);
--> statement-breakpoint
CREATE TABLE "focus_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"minutes" smallint NOT NULL,
	"kind" "focus_kind" DEFAULT 'learning' NOT NULL,
	"topic_id" uuid,
	"note" text,
	"source" "focus_source" DEFAULT 'manual' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "minutes_range" CHECK ("focus_sessions"."minutes" BETWEEN 1 AND 1440),
	CONSTRAINT "timestamps_ordered" CHECK ("focus_sessions"."started_at" IS NULL OR "focus_sessions"."ended_at" IS NULL OR "focus_sessions"."ended_at" >= "focus_sessions"."started_at")
);
--> statement-breakpoint
CREATE TABLE "timer_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"kind" "focus_kind" DEFAULT 'learning' NOT NULL,
	"topic_id" uuid,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"parent_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"what_worked" text,
	"what_didnt" text,
	"change_next" text,
	"top_priority" text,
	"reflection" text,
	"metrics_snapshot" jsonb,
	"snapshot_version" integer,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"month_start_date" date NOT NULL,
	CONSTRAINT "monthly_reviews_user_month_uniq" UNIQUE("user_id","month_start_date")
);
--> statement-breakpoint
CREATE TABLE "weekly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"what_worked" text,
	"what_didnt" text,
	"change_next" text,
	"top_priority" text,
	"reflection" text,
	"metrics_snapshot" jsonb,
	"snapshot_version" integer,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"week_start_date" date NOT NULL,
	CONSTRAINT "weekly_reviews_user_week_uniq" UNIQUE("user_id","week_start_date")
);
--> statement-breakpoint
CREATE TABLE "yearly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"what_worked" text,
	"what_didnt" text,
	"change_next" text,
	"top_priority" text,
	"reflection" text,
	"metrics_snapshot" jsonb,
	"snapshot_version" integer,
	"finalized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"year" integer NOT NULL,
	CONSTRAINT "yearly_reviews_user_year_uniq" UNIQUE("user_id","year"),
	CONSTRAINT "year_sane" CHECK ("yearly_reviews"."year" BETWEEN 1970 AND 2200)
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"severity" "insight_severity" NOT NULL,
	"dedupe_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"period_start" date,
	"period_end" date,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dismissed_at" timestamp with time zone,
	"snoozed_until" date,
	CONSTRAINT "insights_dedupe_uniq" UNIQUE("user_id","dedupe_key")
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_metric_values" ADD CONSTRAINT "custom_metric_values_daily_log_id_daily_logs_id_fk" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_metric_values" ADD CONSTRAINT "custom_metric_values_custom_metric_id_custom_metrics_id_fk" FOREIGN KEY ("custom_metric_id") REFERENCES "public"."custom_metrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_metrics" ADD CONSTRAINT "custom_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_milestones" ADD CONSTRAINT "goal_milestones_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer_state" ADD CONSTRAINT "timer_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer_state" ADD CONSTRAINT "timer_state_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_reviews" ADD CONSTRAINT "monthly_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reviews" ADD CONSTRAINT "weekly_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yearly_reviews" ADD CONSTRAINT "yearly_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_daily_logs_user_date" ON "daily_logs" USING btree ("user_id","log_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_habit_logs_habit_date" ON "habit_logs" USING btree ("habit_id","log_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_habit_logs_user_date" ON "habit_logs" USING btree ("user_id","log_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_habits_user_active" ON "habits" USING btree ("user_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_milestones_goal" ON "goal_milestones" USING btree ("goal_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_goals_user_status" ON "goals" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_focus_sessions_user_date" ON "focus_sessions" USING btree ("user_id","session_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_topics_user" ON "topics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_insights_user_active" ON "insights" USING btree ("user_id","generated_at" DESC NULLS LAST) WHERE dismissed_at IS NULL;