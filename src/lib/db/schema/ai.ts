import { date, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './core'
import { aiReportKindEnum } from './enums-extra'

/**
 * Generated narratives are stored with the model and prompt version that
 * produced them, so an old report can always be read in context (spec 35 §14).
 */
export const aiReports = pgTable(
  'ai_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: aiReportKindEnum('kind').notNull(),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    question: text('question'),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    contentMd: text('content_md').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_ai_reports_user').on(t.userId, t.createdAt.desc())],
)

export type AiReport = typeof aiReports.$inferSelect
