import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './core'
import { projects, projectTasks } from './projects'
import { topics } from './learning'
import { blockKindEnum, recurrenceRuleEnum } from './enums-extra'

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    allDay: boolean('all_day').notNull().default(false),
    category: text('category'),
    location: text('location'),
    note: text('note'),
    recurrenceRule: recurrenceRuleEnum('recurrence_rule'),
    recurrenceUntil: date('recurrence_until'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_events_user_start').on(t.userId, t.startsAt),
    check('event_times_ordered', sql`${t.endsAt} IS NULL OR ${t.endsAt} >= ${t.startsAt}`),
  ],
)

/**
 * Time blocking. This is where forward-looking intent lives, since daily logs
 * are past-only (spec 5.3), and it is what "plan vs actual" compares against.
 */
export const plannedBlocks = pgTable(
  'planned_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockDate: date('block_date').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    kind: blockKindEnum('kind').notNull().default('deep_work'),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    taskId: uuid('task_id').references(() => projectTasks.id, { onDelete: 'set null' }),
    topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_planned_blocks_user_date').on(t.userId, t.blockDate),
    check('block_times_ordered', sql`${t.endTime} > ${t.startTime}`),
  ],
)

export type CalendarEvent = typeof events.$inferSelect
export type PlannedBlock = typeof plannedBlocks.$inferSelect
export type PlannedBlockInsert = typeof plannedBlocks.$inferInsert
