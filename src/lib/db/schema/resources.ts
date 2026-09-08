import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './core'
import { topics } from './learning'
import { resourceStatusEnum, resourceTypeEnum } from './enums-extra'

/** Books, courses, articles — what learning time is spent on (spec 10.2). */
export const resources = pgTable(
  'resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: resourceTypeEnum('type').notNull().default('book'),
    title: text('title').notNull(),
    author: text('author'),
    url: text('url'),
    status: resourceStatusEnum('status').notNull().default('backlog'),
    progressPercent: smallint('progress_percent'),
    rating: smallint('rating'),
    topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
    startedAt: date('started_at'),
    finishedAt: date('finished_at'),
    notes: text('notes'),
    isDemo: boolean('is_demo').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_resources_user_status').on(t.userId, t.status),
    check('progress_range', sql`${t.progressPercent} IS NULL OR ${t.progressPercent} BETWEEN 0 AND 100`),
    check('rating_range', sql`${t.rating} IS NULL OR ${t.rating} BETWEEN 1 AND 5`),
  ],
)

export type Resource = typeof resources.$inferSelect
export type ResourceInsert = typeof resources.$inferInsert
