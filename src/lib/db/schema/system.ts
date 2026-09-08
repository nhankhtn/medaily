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
