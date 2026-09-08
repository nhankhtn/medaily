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
import { interactionChannelEnum, recurrenceRuleEnum, relationshipEnum } from './enums-extra'

export const people = pgTable(
  'people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    relationship: relationshipEnum('relationship').notNull().default('friend'),
    company: text('company'),
    role: text('role'),
    birthday: date('birthday'),
    phone: text('phone'),
    email: text('email'),
    socials: text('socials'),
    notes: text('notes'),
    /** Desired cadence: anyone past it appears in the "reach out" list (spec 15). */
    contactIntervalDays: smallint('contact_interval_days'),
    isDemo: boolean('is_demo').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_people_user').on(t.userId),
    check(
      'contact_interval_positive',
      sql`${t.contactIntervalDays} IS NULL OR ${t.contactIntervalDays} > 0`,
    ),
  ],
)

export const interactions = pgTable(
  'interactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    occurredOn: date('occurred_on').notNull(),
    channel: interactionChannelEnum('channel').notNull().default('message'),
    summary: text('summary'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_interactions_person_date').on(t.personId, t.occurredOn.desc())],
)

/** One reminders table serves every module (spec 15). */
export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    dueOn: date('due_on').notNull(),
    recurrence: recurrenceRuleEnum('recurrence'),
    personId: uuid('person_id').references(() => people.id, { onDelete: 'cascade' }),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    note: text('note'),
    doneAt: timestamp('done_at', { withTimezone: true }),
    snoozedUntil: date('snoozed_until'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_reminders_due')
      .on(t.userId, t.dueOn)
      .where(sql`done_at IS NULL`),
  ],
)

export type Person = typeof people.$inferSelect
export type PersonInsert = typeof people.$inferInsert
export type Interaction = typeof interactions.$inferSelect
export type Reminder = typeof reminders.$inferSelect
