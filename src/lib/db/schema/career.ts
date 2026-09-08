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
import { projects } from './projects'

export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category'),
    level: smallint('level').notNull().default(1),
    targetLevel: smallint('target_level'),
    topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
    notes: text('notes'),
    isDemo: boolean('is_demo').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_skills_user').on(t.userId),
    check('level_range', sql`${t.level} BETWEEN 1 AND 5`),
    check('target_level_range', sql`${t.targetLevel} IS NULL OR ${t.targetLevel} BETWEEN 1 AND 5`),
  ],
)

/** Captured when it happens, not remembered at review time (spec 16). */
export const achievements = pgTable('achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  achievedOn: date('achieved_on').notNull(),
  description: text('description'),
  impact: text('impact'),
  link: text('link'),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const portfolioItems = pgTable('portfolio_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  url: text('url'),
  description: text('description'),
  tech: text('tech').array(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  isDemo: boolean('is_demo').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Skill = typeof skills.$inferSelect
export type Achievement = typeof achievements.$inferSelect
export type PortfolioItem = typeof portfolioItems.$inferSelect
