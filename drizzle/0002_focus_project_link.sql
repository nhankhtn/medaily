ALTER TABLE "focus_sessions" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD COLUMN "task_id" uuid;--> statement-breakpoint
ALTER TABLE "timer_state" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "timer_state" ADD COLUMN "task_id" uuid;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_sessions" ADD CONSTRAINT "focus_sessions_task_id_project_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer_state" ADD CONSTRAINT "timer_state_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timer_state" ADD CONSTRAINT "timer_state_task_id_project_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_focus_sessions_project" ON "focus_sessions" USING btree ("project_id") WHERE project_id IS NOT NULL;