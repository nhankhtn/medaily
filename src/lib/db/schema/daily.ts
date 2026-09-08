import { relations } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './core'
import { customMetricTypeEnum, logSourceEnum, metricAggregationEnum } from './enums'

export const dailyLogs = pgTable(
  'daily_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    logDate: date('log_date').notNull(),

    energy: smallint('energy'),
    mood: smallint('mood'),
    sleepHours: numeric('sleep_hours', { precision: 3, scale: 1 }),
    bedtime: time('bedtime'),
    wakeTime: time('wake_time'),

    technicalStudyMinutes: smallint('technical_study_minutes'),
    deepWorkMinutes: smallint('deep_work_minutes'),
    exerciseMinutes: smallint('exercise_minutes'),
    exerciseType: text('exercise_type'),
    readingMinutes: smallint('reading_minutes'),
    readingPages: smallint('reading_pages'),
    entertainmentMinutes: smallint('entertainment_minutes'),
    englishMinutes: smallint('english_minutes'),

    dailyWin: text('daily_win'),
    dailyProblem: text('daily_problem'),
    tomorrowPriority: text('tomorrow_priority'),
    note: text('note'),

    source: logSourceEnum('source').notNull().default('manual'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('daily_logs_user_date_uniq').on(t.userId, t.logDate),
    index('idx_daily_logs_user_date').on(t.userId, t.logDate.desc()),
    check('energy_range', sql`${t.energy} IS NULL OR ${t.energy} BETWEEN 1 AND 10`),
    check('mood_range', sql`${t.mood} IS NULL OR ${t.mood} BETWEEN 1 AND 10`),
    check('sleep_range', sql`${t.sleepHours} IS NULL OR ${t.sleepHours} BETWEEN 0 AND 24`),
    check(
      'study_range',
      sql`${t.technicalStudyMinutes} IS NULL OR ${t.technicalStudyMinutes} BETWEEN 0 AND 1440`,
    ),
    check(
      'deep_work_range',
      sql`${t.deepWorkMinutes} IS NULL OR ${t.deepWorkMinutes} BETWEEN 0 AND 1440`,
    ),
    check(
      'exercise_range',
      sql`${t.exerciseMinutes} IS NULL OR ${t.exerciseMinutes} BETWEEN 0 AND 1440`,
    ),
    check(
      'reading_range',
      sql`${t.readingMinutes} IS NULL OR ${t.readingMinutes} BETWEEN 0 AND 1440`,
    ),
    check(
      'entertainment_range',
      sql`${t.entertainmentMinutes} IS NULL OR ${t.entertainmentMinutes} BETWEEN 0 AND 1440`,
    ),
    check(
      'english_range',
      sql`${t.englishMinutes} IS NULL OR ${t.englishMinutes} BETWEEN 0 AND 1440`,
    ),
    check('reading_pages_range', sql`${t.readingPages} IS NULL OR ${t.readingPages} >= 0`),
    // +1 day tolerates timezone skew between the app server and the database
    check('no_future_log', sql`${t.logDate} <= CURRENT_DATE + 1`),
  ],
)

export const customMetrics = pgTable(
  'custom_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    labelEn: text('label_en').notNull(),
    labelVi: text('label_vi').notNull(),
    type: customMetricTypeEnum('type').notNull().default('number'),
    unit: text('unit'),
    min: numeric('min'),
    max: numeric('max'),
    aggregation: metricAggregationEnum('aggregation').notNull().default('sum'),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('custom_metrics_user_key_uniq').on(t.userId, t.key)],
)

export const customMetricValues = pgTable(
  'custom_metric_values',
  {
    dailyLogId: uuid('daily_log_id')
      .notNull()
      .references(() => dailyLogs.id, { onDelete: 'cascade' }),
    customMetricId: uuid('custom_metric_id')
      .notNull()
      .references(() => customMetrics.id, { onDelete: 'cascade' }),
    valueNumeric: numeric('value_numeric'),
    valueBool: boolean('value_bool'),
    valueText: text('value_text'),
  },
  (t) => [
    primaryKey({ columns: [t.dailyLogId, t.customMetricId] }),
    check(
      'exactly_one_value',
      sql`(CASE WHEN ${t.valueNumeric} IS NULL THEN 0 ELSE 1 END
         + CASE WHEN ${t.valueBool} IS NULL THEN 0 ELSE 1 END
         + CASE WHEN ${t.valueText} IS NULL THEN 0 ELSE 1 END) = 1`,
    ),
  ],
)

export const dailyLogsRelations = relations(dailyLogs, ({ many }) => ({
  customValues: many(customMetricValues),
}))

export const customMetricValuesRelations = relations(customMetricValues, ({ one }) => ({
  dailyLog: one(dailyLogs, {
    fields: [customMetricValues.dailyLogId],
    references: [dailyLogs.id],
  }),
  metric: one(customMetrics, {
    fields: [customMetricValues.customMetricId],
    references: [customMetrics.id],
  }),
}))

export type DailyLog = typeof dailyLogs.$inferSelect
export type DailyLogInsert = typeof dailyLogs.$inferInsert
export type CustomMetric = typeof customMetrics.$inferSelect
