import { date, numeric, pgView, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { logSourceEnum } from './enums'

/**
 * Spec 27.3 — created by `drizzle/views.sql` and declared here as an existing
 * view so queries stay typed. This is the only read path for analytics,
 * scoring, streaks and reviews: it resolves manual minutes against focus
 * sessions so callers never have to know which one won.
 */
export const dailyEffective = pgView('v_daily_effective', {
  id: uuid('id').notNull(),
  userId: uuid('user_id').notNull(),
  logDate: date('log_date').notNull(),
  energy: smallint('energy'),
  mood: smallint('mood'),
  sleepHours: numeric('sleep_hours'),
  bedtime: text('bedtime'),
  wakeTime: text('wake_time'),
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
  source: logSourceEnum('source').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  effectiveStudyMinutes: smallint('effective_study_minutes'),
  effectiveDeepWorkMinutes: smallint('effective_deep_work_minutes'),
  sessionCount: smallint('session_count').notNull(),
}).existing()

export type DailyEffectiveRow = typeof dailyEffective.$inferSelect
