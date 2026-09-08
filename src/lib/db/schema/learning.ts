import { relations, sql } from 'drizzle-orm'
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
import { projectTasks, projects } from './projects'
import { focusKindEnum, focusSourceEnum } from './enums'

export const topics = pgTable(
  'topics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category'),
    parentId: uuid('parent_id'),
    isDemo: boolean('is_demo').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_topics_user').on(t.userId)],
)

/**
 * Renamed from the v1 spec's `study_sessions`: the same shape records learning,
 * deep work and project time, so one table serves one query path (spec 10.1).
 * `session_date` is the rollover-aware logical date, which keeps the
 * `v_daily_effective` join free of timezone math.
 */
export const focusSessions = pgTable(
  'focus_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionDate: date('session_date').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    minutes: smallint('minutes').notNull(),
    kind: focusKindEnum('kind').notNull().default('learning'),
    topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
    // Project attribution is what makes "time spent" on a project derivable
    // rather than hand-typed (spec 9).
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    taskId: uuid('task_id').references(() => projectTasks.id, { onDelete: 'set null' }),
    note: text('note'),
    source: focusSourceEnum('source').notNull().default('manual'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_focus_sessions_user_date').on(t.userId, t.sessionDate.desc()),
    index('idx_focus_sessions_project')
      .on(t.projectId)
      .where(sql`project_id IS NOT NULL`),
    check('minutes_range', sql`${t.minutes} BETWEEN 1 AND 1440`),
    check(
      'timestamps_ordered',
      sql`${t.startedAt} IS NULL OR ${t.endedAt} IS NULL OR ${t.endedAt} >= ${t.startedAt}`,
    ),
  ],
)

export const timerState = pgTable('timer_state', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  kind: focusKindEnum('kind').notNull().default('learning'),
  topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  taskId: uuid('task_id').references(() => projectTasks.id, { onDelete: 'set null' }),
  note: text('note'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const topicsRelations = relations(topics, ({ many, one }) => ({
  sessions: many(focusSessions),
  parent: one(topics, { fields: [topics.parentId], references: [topics.id] }),
}))

export const focusSessionsRelations = relations(focusSessions, ({ one }) => ({
  topic: one(topics, { fields: [focusSessions.topicId], references: [topics.id] }),
}))

export type Topic = typeof topics.$inferSelect
export type FocusSession = typeof focusSessions.$inferSelect
