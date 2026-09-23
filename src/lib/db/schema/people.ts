import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
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
    /**
     * Where money sent to this person lands. Flat columns rather than a table
     * of its own: one account each covers everyone this is for, and a second
     * bank per person can earn the table on the day it exists.
     *
     * `bank_bin` is the Napas code the VietQR payload is built from — the same
     * six digits a bank app shows beside its name, not the SWIFT code.
     */
    bankBin: text('bank_bin'),
    bankAccountNumber: text('bank_account_number'),
    /** Shown before the transfer so a wrong row is caught by eye, not by the bank. */
    bankAccountName: text('bank_account_name'),
    momoPhone: text('momo_phone'),
    paymentQr: text('payment_qr'),
    /** Desired cadence: anyone past it appears in the "reach out" list (spec 15). */
    contactIntervalDays: smallint('contact_interval_days'),
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_interactions_person_date').on(t.personId, t.occurredOn.desc())],
)

/**
 * Photos live on Cloudinary; this table holds only what is needed to build a
 * URL and order a gallery. `public_id` is the Cloudinary handle, unique per
 * user so a re-upload cannot silently shadow an existing asset.
 */
export const personPhotos = pgTable(
  'person_photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    personId: uuid('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    publicId: text('public_id').notNull(),
    format: text('format'),
    width: integer('width'),
    height: integer('height'),
    bytes: integer('bytes'),
    caption: text('caption'),
    takenOn: date('taken_on'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('person_photos_user_public_id_uniq').on(t.userId, t.publicId),
    index('idx_person_photos_person').on(t.personId, t.createdAt.desc()),
  ],
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
export type PersonPhoto = typeof personPhotos.$inferSelect
