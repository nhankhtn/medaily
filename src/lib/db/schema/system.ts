import { date, index, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './core'
import { insightSeverityEnum } from './enums'
import type { InsightPayload } from '../../types'

/**
 * Generated warnings and wins are persisted so that dismiss/snooze survives a
 * reload (spec 18.4). `dedupe_key` keeps one row per rule occurrence.
 */
export const insights = pgTable(
  'insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    severity: insightSeverityEnum('severity').notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    payload: jsonb('payload').$type<InsightPayload>().notNull(),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    snoozedUntil: date('snoozed_until'),
  },
  (t) => [
    unique('insights_dedupe_uniq').on(t.userId, t.dedupeKey),
    index('idx_insights_user_active')
      .on(t.userId, t.generatedAt.desc())
      .where(sql`dismissed_at IS NULL`),
  ],
)

export type Insight = typeof insights.$inferSelect

/**
 * One inbox for every kind of notice.
 *
 * The table does not know what a grant expense looks like. `kind` says which
 * reader to use and `payload` holds that kind's facts. A new notice is a new
 * kind and a new reader — the columns stay. `dedupe_key` is how one event
 * stays one row when it is announced twice; a row without one does not collide.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    dedupeKey: text('dedupe_key'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('notifications_user_dedupe_uniq').on(t.userId, t.dedupeKey),
    index('idx_notifications_user_created').on(t.userId, t.createdAt.desc()),
    index('idx_notifications_user_unread')
      .on(t.userId)
      .where(sql`read_at IS NULL`),
  ],
)

export type StoredNotification = typeof notifications.$inferSelect
