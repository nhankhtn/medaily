import { relations, sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './core'
import { goals } from './goals'
import { priorityEnum } from './enums'
import { projectStatusEnum, taskStatusEnum } from './enums-extra'

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    status: projectStatusEnum('status').notNull().default('active'),
    priority: priorityEnum('priority').notNull().default('medium'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'set null' }),
    color: text('color'),
    notes: text('notes'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_projects_user_status').on(t.userId, t.status),
    check('project_dates_ordered', sql`${t.endDate} IS NULL OR ${t.startDate} IS NULL OR ${t.endDate} >= ${t.startDate}`),
  ],
)

export const projectTasks = pgTable(
  'project_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    // One level of sub-tasks: deeper trees turn a personal tool into Jira.
    parentTaskId: uuid('parent_task_id'),
    title: text('title').notNull(),
    status: taskStatusEnum('status').notNull().default('todo'),
    priority: priorityEnum('priority').notNull().default('medium'),
    dueDate: date('due_date'),
    estimateMinutes: smallint('estimate_minutes'),
    sortOrder: integer('sort_order').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_tasks_project_status').on(t.projectId, t.status),
    index('idx_tasks_user_due').on(t.userId, t.dueDate),
    check('estimate_range', sql`${t.estimateMinutes} IS NULL OR ${t.estimateMinutes} BETWEEN 0 AND 10080`),
  ],
)

export const projectsRelations = relations(projects, ({ many, one }) => ({
  tasks: many(projectTasks),
  goal: one(goals, { fields: [projects.goalId], references: [goals.id] }),
}))

export const projectTasksRelations = relations(projectTasks, ({ one }) => ({
  project: one(projects, { fields: [projectTasks.projectId], references: [projects.id] }),
}))

export type Project = typeof projects.$inferSelect
export type ProjectInsert = typeof projects.$inferInsert
export type ProjectTask = typeof projectTasks.$inferSelect
export type ProjectTaskInsert = typeof projectTasks.$inferInsert
