import { sql } from 'drizzle-orm'
import {
  customType,
  date,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './core'
import { topics } from './learning'
import { resources } from './resources'
import { noteTypeEnum } from './enums-extra'

/**
 * Maintained by a trigger (see drizzle/views.sql) rather than a generated
 * column, because the diacritic-folding function has to exist before the
 * column that uses it — and migrations run before that SQL.
 */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => 'tsvector',
})

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    bodyMd: text('body_md'),
    type: noteTypeEnum('type').notNull().default('note'),
    url: text('url'),
    topicId: uuid('topic_id').references(() => topics.id, { onDelete: 'set null' }),
    resourceId: uuid('resource_id').references(() => resources.id, { onDelete: 'set null' }),
    searchTsv: tsvector('search_tsv'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_notes_user_updated').on(t.userId, t.updatedAt.desc()),
    index('idx_notes_search').using('gin', t.searchTsv),
  ],
)

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('tags_user_name_uniq').on(t.userId, t.name)],
)

export const noteTags = pgTable(
  'note_tags',
  {
    noteId: uuid('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.noteId, t.tagId] })],
)

/** `[[wiki links]]` resolved at save time; unresolved targets are kept by title. */
export const noteLinks = pgTable(
  'note_links',
  {
    sourceNoteId: uuid('source_note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    targetNoteId: uuid('target_note_id').references(() => notes.id, { onDelete: 'cascade' }),
    targetTitle: text('target_title').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sourceNoteId, t.targetTitle] }),
    index('idx_note_links_target').on(t.targetNoteId),
  ],
)

/**
 * Long-form reflection, many per day — distinct from `daily_logs.note`, which
 * is a single quick line inside the day's log (spec 13.1).
 */
export const journalEntries = pgTable(
  'journal_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entryDate: date('entry_date').notNull(),
    title: text('title'),
    bodyMd: text('body_md').notNull(),
    mood: smallint('mood'),
    tags: text('tags').array(),
    searchTsv: tsvector('search_tsv'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_journal_user_date').on(t.userId, t.entryDate.desc()),
    index('idx_journal_search').using('gin', t.searchTsv),
  ],
)

export type Note = typeof notes.$inferSelect
export type NoteInsert = typeof notes.$inferInsert
export type Tag = typeof tags.$inferSelect
export type JournalEntry = typeof journalEntries.$inferSelect
export type JournalEntryInsert = typeof journalEntries.$inferInsert

export const NOTE_SEARCH_CONFIG = sql`simple`
