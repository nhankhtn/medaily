CREATE TYPE "public"."account_type" AS ENUM('cash', 'bank', 'credit_card', 'e_wallet', 'investment', 'loan');--> statement-breakpoint
CREATE TYPE "public"."ai_report_kind" AS ENUM('weekly', 'monthly', 'question');--> statement-breakpoint
CREATE TYPE "public"."block_kind" AS ENUM('learning', 'deep_work', 'project', 'exercise', 'other');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."interaction_channel" AS ENUM('in_person', 'call', 'message', 'email', 'other');--> statement-breakpoint
CREATE TYPE "public"."note_type" AS ENUM('note', 'concept', 'bookmark');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('planned', 'active', 'on_hold', 'done', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."recurrence_rule" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."relationship" AS ENUM('family', 'friend', 'colleague', 'mentor', 'other');--> statement-breakpoint
CREATE TYPE "public"."resource_status" AS ENUM('backlog', 'in_progress', 'done', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('book', 'course', 'article', 'video', 'other');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'doing', 'blocked', 'done');--> statement-breakpoint
CREATE TYPE "public"."transaction_kind" AS ENUM('income', 'expense', 'transfer');--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"due_date" date,
	"estimate_minutes" smallint,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimate_range" CHECK ("project_tasks"."estimate_minutes" IS NULL OR "project_tasks"."estimate_minutes" BETWEEN 0 AND 10080)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"start_date" date,
	"end_date" date,
	"goal_id" uuid,
	"color" text,
	"notes" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_dates_ordered" CHECK ("projects"."end_date" IS NULL OR "projects"."start_date" IS NULL OR "projects"."end_date" >= "projects"."start_date")
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "resource_type" DEFAULT 'book' NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"url" text,
	"status" "resource_status" DEFAULT 'backlog' NOT NULL,
	"progress_percent" smallint,
	"rating" smallint,
	"topic_id" uuid,
	"started_at" date,
	"finished_at" date,
	"notes" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progress_range" CHECK ("resources"."progress_percent" IS NULL OR "resources"."progress_percent" BETWEEN 0 AND 100),
	CONSTRAINT "rating_range" CHECK ("resources"."rating" IS NULL OR "resources"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "body_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"measured_on" date NOT NULL,
	"weight_kg" numeric(5, 2),
	"body_fat_pct" numeric(4, 1),
	"waist_cm" numeric(5, 1),
	"resting_hr" smallint,
	"blood_pressure" text,
	"note" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "body_measurements_user_date_uniq" UNIQUE("user_id","measured_on"),
	CONSTRAINT "weight_range" CHECK ("body_measurements"."weight_kg" IS NULL OR "body_measurements"."weight_kg" BETWEEN 20 AND 400),
	CONSTRAINT "hr_range" CHECK ("body_measurements"."resting_hr" IS NULL OR "body_measurements"."resting_hr" BETWEEN 20 AND 220)
);
--> statement-breakpoint
CREATE TABLE "nutrition_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"log_date" date NOT NULL,
	"calories" smallint,
	"protein_g" smallint,
	"carbs_g" smallint,
	"fat_g" smallint,
	"water_ml" smallint,
	"note" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nutrition_logs_user_date_uniq" UNIQUE("user_id","log_date"),
	CONSTRAINT "calories_range" CHECK ("nutrition_logs"."calories" IS NULL OR "nutrition_logs"."calories" BETWEEN 0 AND 20000)
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workout_id" uuid NOT NULL,
	"exercise" text NOT NULL,
	"sets" smallint,
	"reps" smallint,
	"weight_kg" numeric(6, 2),
	"rest_seconds" smallint,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"performed_on" date NOT NULL,
	"type" text NOT NULL,
	"duration_minutes" smallint NOT NULL,
	"distance_km" numeric(6, 2),
	"calories" smallint,
	"rpe" smallint,
	"note" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duration_range" CHECK ("workouts"."duration_minutes" BETWEEN 1 AND 1440),
	CONSTRAINT "rpe_range" CHECK ("workouts"."rpe" IS NULL OR "workouts"."rpe" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" DEFAULT 'bank' NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"opening_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"color" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "currency_code" CHECK (char_length("accounts"."currency") = 3)
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'asset' NOT NULL,
	"value" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"as_of" date NOT NULL,
	"note" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"rollover" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_user_category_period_uniq" UNIQUE("user_id","category_id","period_start"),
	CONSTRAINT "budget_positive" CHECK ("budgets"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "finance_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "category_kind" DEFAULT 'expense' NOT NULL,
	"parent_id" uuid,
	"icon" text,
	"color" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"name" text,
	"quantity" numeric(18, 6) NOT NULL,
	"avg_cost" numeric(14, 2) NOT NULL,
	"last_price" numeric(14, 2),
	"priced_at" date,
	"currency" text DEFAULT 'VND' NOT NULL,
	"note" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"kind" "transaction_kind" NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"rule" "recurrence_rule" DEFAULT 'monthly' NOT NULL,
	"next_due_on" date NOT NULL,
	"ends_on" date,
	"note" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"occurred_on" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"kind" "transaction_kind" NOT NULL,
	"account_id" uuid NOT NULL,
	"counter_account_id" uuid,
	"fx_rate" numeric(14, 6),
	"category_id" uuid,
	"merchant" text,
	"note" text,
	"tags" text[],
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amount_positive" CHECK ("transactions"."amount" > 0),
	CONSTRAINT "transfer_has_counter_account" CHECK ("transactions"."kind" <> 'transfer' OR ("transactions"."counter_account_id" IS NOT NULL AND "transactions"."counter_account_id" <> "transactions"."account_id"))
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entry_date" date NOT NULL,
	"title" text,
	"body_md" text NOT NULL,
	"mood" smallint,
	"tags" text[],
	"search_tsv" "tsvector",
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_links" (
	"source_note_id" uuid NOT NULL,
	"target_note_id" uuid,
	"target_title" text NOT NULL,
	CONSTRAINT "note_links_source_note_id_target_title_pk" PRIMARY KEY("source_note_id","target_title")
);
--> statement-breakpoint
CREATE TABLE "note_tags" (
	"note_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "note_tags_note_id_tag_id_pk" PRIMARY KEY("note_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body_md" text,
	"type" "note_type" DEFAULT 'note' NOT NULL,
	"url" text,
	"topic_id" uuid,
	"resource_id" uuid,
	"search_tsv" "tsvector",
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_user_name_uniq" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"all_day" boolean DEFAULT false NOT NULL,
	"category" text,
	"location" text,
	"note" text,
	"recurrence_rule" "recurrence_rule",
	"recurrence_until" date,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_times_ordered" CHECK ("events"."ends_at" IS NULL OR "events"."ends_at" >= "events"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "planned_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"block_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"kind" "block_kind" DEFAULT 'deep_work' NOT NULL,
	"project_id" uuid,
	"task_id" uuid,
	"topic_id" uuid,
	"note" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "block_times_ordered" CHECK ("planned_blocks"."end_time" > "planned_blocks"."start_time")
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"occurred_on" date NOT NULL,
	"channel" "interaction_channel" DEFAULT 'message' NOT NULL,
	"summary" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relationship" "relationship" DEFAULT 'friend' NOT NULL,
	"company" text,
	"role" text,
	"birthday" date,
	"phone" text,
	"email" text,
	"socials" text,
	"notes" text,
	"contact_interval_days" smallint,
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_interval_positive" CHECK ("people"."contact_interval_days" IS NULL OR "people"."contact_interval_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"due_on" date NOT NULL,
	"recurrence" "recurrence_rule",
	"person_id" uuid,
	"entity_type" text,
	"entity_id" uuid,
	"note" text,
	"done_at" timestamp with time zone,
	"snoozed_until" date,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"achieved_on" date NOT NULL,
	"description" text,
	"impact" text,
	"link" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"description" text,
	"tech" text[],
	"project_id" uuid,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"level" smallint DEFAULT 1 NOT NULL,
	"target_level" smallint,
	"topic_id" uuid,
	"notes" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "level_range" CHECK ("skills"."level" BETWEEN 1 AND 5),
	CONSTRAINT "target_level_range" CHECK ("skills"."target_level" IS NULL OR "skills"."target_level" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "ai_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "ai_report_kind" NOT NULL,
	"period_start" date,
	"period_end" date,
	"question" text,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"content_md" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_logs" ADD CONSTRAINT "nutrition_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_categories" ADD CONSTRAINT "finance_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transactions" ADD CONSTRAINT "recurring_transactions_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_counter_account_id_accounts_id_fk" FOREIGN KEY ("counter_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_finance_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."finance_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_source_note_id_notes_id_fk" FOREIGN KEY ("source_note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_links" ADD CONSTRAINT "note_links_target_note_id_notes_id_fk" FOREIGN KEY ("target_note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_tags" ADD CONSTRAINT "note_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_blocks" ADD CONSTRAINT "planned_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_blocks" ADD CONSTRAINT "planned_blocks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_blocks" ADD CONSTRAINT "planned_blocks_task_id_project_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_blocks" ADD CONSTRAINT "planned_blocks_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tasks_project_status" ON "project_tasks" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "idx_tasks_user_due" ON "project_tasks" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE INDEX "idx_projects_user_status" ON "projects" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_resources_user_status" ON "resources" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_measurements_user_date" ON "body_measurements" USING btree ("user_id","measured_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_workouts_user_date" ON "workouts" USING btree ("user_id","performed_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_accounts_user" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_finance_categories_user" ON "finance_categories" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "idx_transactions_user_date" ON "transactions" USING btree ("user_id","occurred_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_transactions_category" ON "transactions" USING btree ("category_id","occurred_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_journal_user_date" ON "journal_entries" USING btree ("user_id","entry_date" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_journal_search" ON "journal_entries" USING gin ("search_tsv");--> statement-breakpoint
CREATE INDEX "idx_note_links_target" ON "note_links" USING btree ("target_note_id");--> statement-breakpoint
CREATE INDEX "idx_notes_user_updated" ON "notes" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_notes_search" ON "notes" USING gin ("search_tsv");--> statement-breakpoint
CREATE INDEX "idx_events_user_start" ON "events" USING btree ("user_id","starts_at");--> statement-breakpoint
CREATE INDEX "idx_planned_blocks_user_date" ON "planned_blocks" USING btree ("user_id","block_date");--> statement-breakpoint
CREATE INDEX "idx_interactions_person_date" ON "interactions" USING btree ("person_id","occurred_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_people_user" ON "people" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_reminders_due" ON "reminders" USING btree ("user_id","due_on") WHERE done_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_skills_user" ON "skills" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_reports_user" ON "ai_reports" USING btree ("user_id","created_at" DESC NULLS LAST);