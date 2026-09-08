import { sql } from 'drizzle-orm'
import {
  check,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './core'
import type { ReviewMetricsSnapshot } from '../../types'

const reviewFields = {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  whatWorked: text('what_worked'),
  whatDidnt: text('what_didnt'),
  changeNext: text('change_next'),
  topPriority: text('top_priority'),
  reflection: text('reflection'),
  metricsSnapshot: jsonb('metrics_snapshot').$type<ReviewMetricsSnapshot>(),
  snapshotVersion: integer('snapshot_version'),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

export const weeklyReviews = pgTable(
  'weekly_reviews',
  { ...reviewFields, weekStartDate: date('week_start_date').notNull() },
  (t) => [unique('weekly_reviews_user_week_uniq').on(t.userId, t.weekStartDate)],
)

export const monthlyReviews = pgTable(
  'monthly_reviews',
  { ...reviewFields, monthStartDate: date('month_start_date').notNull() },
  (t) => [unique('monthly_reviews_user_month_uniq').on(t.userId, t.monthStartDate)],
)

export const yearlyReviews = pgTable(
  'yearly_reviews',
  { ...reviewFields, year: integer('year').notNull() },
  (t) => [
    unique('yearly_reviews_user_year_uniq').on(t.userId, t.year),
    check('year_sane', sql`${t.year} BETWEEN 1970 AND 2200`),
  ],
)

export type WeeklyReview = typeof weeklyReviews.$inferSelect
export type MonthlyReview = typeof monthlyReviews.$inferSelect
