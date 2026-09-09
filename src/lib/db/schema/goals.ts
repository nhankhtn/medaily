import { relations, sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './core'
import {
  goalStatusEnum,
  metricAggregationEnum,
  metricDirectionEnum,
  metricPeriodEnum,
  priorityEnum,
  progressModeEnum,
  recurrenceEnum,
} from './enums'

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category').notNull().default('life'),
    status: goalStatusEnum('status').notNull().default('active'),
    priority: priorityEnum('priority').notNull().default('medium'),
    startDate: date('start_date').notNull(),
    targetDate: date('target_date'),

    progressMode: progressModeEnum('progress_mode').notNull().default('manual'),
    progressManual: numeric('progress_manual', { precision: 5, scale: 2 }),
    progressUpdatedAt: timestamp('progress_updated_at', { withTimezone: true }),

    metricKey: text('metric_key'),
    metricAggregation: metricAggregationEnum('metric_aggregation'),
    metricPeriod: metricPeriodEnum('metric_period'),
    metricTarget: numeric('metric_target'),
    metricDirection: metricDirectionEnum('metric_direction').default('at_least'),

    recurrence: recurrenceEnum('recurrence'),
    notes: text('notes'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_goals_user_status').on(t.userId, t.status),
    check(
      'manual_progress_range',
      sql`${t.progressManual} IS NULL OR ${t.progressManual} BETWEEN 0 AND 100`,
    ),
    check(
      'metric_mode_complete',
      sql`${t.progressMode} <> 'metric' OR (${t.metricKey} IS NOT NULL
        AND ${t.metricAggregation} IS NOT NULL
        AND ${t.metricPeriod} IS NOT NULL
        AND ${t.metricTarget} IS NOT NULL
        AND ${t.metricTarget} > 0)`,
    ),
    check('goal_dates_ordered', sql`${t.targetDate} IS NULL OR ${t.targetDate} >= ${t.startDate}`),
  ],
)

export const goalMilestones = pgTable(
  'goal_milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    goalId: uuid('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    dueDate: date('due_date'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    weight: numeric('weight').notNull().default('1'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_milestones_goal').on(t.goalId, t.sortOrder),
    check('weight_positive', sql`${t.weight} > 0`),
  ],
)

export const goalsRelations = relations(goals, ({ many }) => ({
  milestones: many(goalMilestones),
}))

export const goalMilestonesRelations = relations(goalMilestones, ({ one }) => ({
  goal: one(goals, { fields: [goalMilestones.goalId], references: [goals.id] }),
}))

export type Goal = typeof goals.$inferSelect
export type GoalInsert = typeof goals.$inferInsert
export type GoalMilestone = typeof goalMilestones.$inferSelect
