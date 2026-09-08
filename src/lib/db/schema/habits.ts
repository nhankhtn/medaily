import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './core'
import { habitFrequencyEnum, habitOperatorEnum, logSourceEnum } from './enums'

export const habits = pgTable(
  'habits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category').notNull().default('life'),
    icon: text('icon'),
    color: text('color'),

    frequencyType: habitFrequencyEnum('frequency_type').notNull().default('daily'),
    targetCount: smallint('target_count').notNull().default(1),
    weekdays: smallint('weekdays').array(),
    intervalDays: smallint('interval_days'),

    // Metric binding: when set, completion is derived from the daily log (spec 7.3)
    linkedMetric: text('linked_metric'),
    linkedOperator: habitOperatorEnum('linked_operator'),
    linkedThreshold: numeric('linked_threshold'),

    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    notes: text('notes'),
    sortOrder: integer('sort_order').notNull().default(0),
    isDemo: boolean('is_demo').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_habits_user_active').on(t.userId, t.sortOrder),
    check('target_count_positive', sql`${t.targetCount} >= 1`),
    check(
      'interval_days_valid',
      sql`${t.frequencyType} <> 'interval' OR (${t.intervalDays} IS NOT NULL AND ${t.intervalDays} >= 1)`,
    ),
    check(
      'weekdays_valid',
      sql`${t.frequencyType} <> 'specific_days' OR (${t.weekdays} IS NOT NULL AND array_length(${t.weekdays}, 1) >= 1)`,
    ),
    check(
      'link_complete',
      sql`${t.linkedMetric} IS NULL OR (${t.linkedOperator} IS NOT NULL AND ${t.linkedThreshold} IS NOT NULL)`,
    ),
    check('dates_ordered', sql`${t.endDate} IS NULL OR ${t.endDate} >= ${t.startDate}`),
  ],
)

export const habitLogs = pgTable(
  'habit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    habitId: uuid('habit_id')
      .notNull()
      .references(() => habits.id, { onDelete: 'cascade' }),
    logDate: date('log_date').notNull(),
    count: smallint('count').notNull().default(1),
    completed: boolean('completed').notNull().default(true),
    source: logSourceEnum('source').notNull().default('manual'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('habit_logs_habit_date_uniq').on(t.habitId, t.logDate),
    index('idx_habit_logs_habit_date').on(t.habitId, t.logDate.desc()),
    index('idx_habit_logs_user_date').on(t.userId, t.logDate.desc()),
    check('count_non_negative', sql`${t.count} >= 0`),
  ],
)

export const habitsRelations = relations(habits, ({ many }) => ({
  logs: many(habitLogs),
}))

export const habitLogsRelations = relations(habitLogs, ({ one }) => ({
  habit: one(habits, { fields: [habitLogs.habitId], references: [habits.id] }),
}))

export type Habit = typeof habits.$inferSelect
export type HabitInsert = typeof habits.$inferInsert
export type HabitLog = typeof habitLogs.$inferSelect
