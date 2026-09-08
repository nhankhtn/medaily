import { and, asc, between, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { journalEntries, noteLinks, noteTags, notes, tags } from '@/lib/db/schema'
import type { JournalEntry, Note, NoteInsert, Tag } from '@/lib/db/schema'
import type { DateRange, ISODate } from '@/lib/dates'

export async function findNotes(userId: string, limit = 100): Promise<Note[]> {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), isNull(notes.archivedAt)))
    .orderBy(desc(notes.updatedAt))
    .limit(limit)
}

export async function findNote(userId: string, noteId: string): Promise<Note | null> {
  const rows = await db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.id, noteId)))
    .limit(1)
  return rows[0] ?? null
}

export async function upsertNote(
  userId: string,
  values: Omit<NoteInsert, 'userId'> & { id?: string },
): Promise<Note> {
  if (values.id) {
    const rows = await db
      .update(notes)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(notes.userId, userId), eq(notes.id, values.id)))
      .returning()
    const row = rows[0]
    if (!row) throw new Error('note not found')
    return row
  }

  const rows = await db
    .insert(notes)
    .values({ ...values, userId })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert note')
  return row
}

export async function deleteNote(userId: string, noteId: string): Promise<void> {
  await db.delete(notes).where(and(eq(notes.userId, userId), eq(notes.id, noteId)))
}

export async function findTags(userId: string): Promise<Tag[]> {
  return db.select().from(tags).where(eq(tags.userId, userId)).orderBy(asc(tags.name))
}

export async function ensureTags(userId: string, names: string[]): Promise<Tag[]> {
  if (names.length === 0) return []
  await db
    .insert(tags)
    .values(names.map((name) => ({ userId, name })))
    .onConflictDoNothing({ target: [tags.userId, tags.name] })

  return db
    .select()
    .from(tags)
    .where(and(eq(tags.userId, userId), inArray(tags.name, names)))
}

export async function setNoteTags(noteId: string, tagIds: string[]): Promise<void> {
  await db.delete(noteTags).where(eq(noteTags.noteId, noteId))
  if (tagIds.length === 0) return
  await db.insert(noteTags).values(tagIds.map((tagId) => ({ noteId, tagId })))
}

export async function findNoteTags(noteIds: string[]) {
  if (noteIds.length === 0) return []
  return db
    .select({ noteId: noteTags.noteId, tagId: noteTags.tagId, name: tags.name })
    .from(noteTags)
    .innerJoin(tags, eq(tags.id, noteTags.tagId))
    .where(inArray(noteTags.noteId, noteIds))
}

/**
 * `[[wiki links]]` are resolved to note ids where a matching title exists, and
 * kept by title where it does not — an unresolved link is a note worth writing,
 * not an error (spec 13.2).
 */
export async function replaceNoteLinks(
  userId: string,
  sourceNoteId: string,
  titles: string[],
): Promise<void> {
  await db.delete(noteLinks).where(eq(noteLinks.sourceNoteId, sourceNoteId))
  if (titles.length === 0) return

  const targets = await db
    .select({ id: notes.id, title: notes.title })
    .from(notes)
    .where(
      and(
        eq(notes.userId, userId),
        inArray(
          sql`lower(${notes.title})`,
          titles.map((title) => title.toLowerCase()),
        ),
      ),
    )

  await db.insert(noteLinks).values(
    titles.map((title) => ({
      sourceNoteId,
      targetTitle: title,
      targetNoteId:
        targets.find((target) => target.title.toLowerCase() === title.toLowerCase())?.id ?? null,
    })),
  )
}

export async function findBacklinks(userId: string, noteId: string, title: string) {
  return db
    .select({ id: notes.id, title: notes.title })
    .from(noteLinks)
    .innerJoin(notes, eq(notes.id, noteLinks.sourceNoteId))
    .where(
      and(
        eq(notes.userId, userId),
        sql`(${noteLinks.targetNoteId} = ${noteId} OR lower(${noteLinks.targetTitle}) = ${title.toLowerCase()})`,
      ),
    )
}

export async function findJournalEntries(
  userId: string,
  range?: DateRange,
  limit = 60,
): Promise<JournalEntry[]> {
  return db
    .select()
    .from(journalEntries)
    .where(
      range
        ? and(
            eq(journalEntries.userId, userId),
            between(journalEntries.entryDate, range.start, range.end),
          )
        : eq(journalEntries.userId, userId),
    )
    .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
    .limit(limit)
}

export async function upsertJournalEntry(
  userId: string,
  values: {
    id?: string
    entryDate: ISODate
    title?: string | null
    bodyMd: string
    mood?: number | null
    tags?: string[] | null
  },
): Promise<JournalEntry> {
  if (values.id) {
    const rows = await db
      .update(journalEntries)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(journalEntries.userId, userId), eq(journalEntries.id, values.id)))
      .returning()
    const row = rows[0]
    if (!row) throw new Error('journal entry not found')
    return row
  }

  const rows = await db
    .insert(journalEntries)
    .values({ ...values, userId })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert journal entry')
  return row
}

export async function deleteJournalEntry(userId: string, id: string): Promise<void> {
  await db
    .delete(journalEntries)
    .where(and(eq(journalEntries.userId, userId), eq(journalEntries.id, id)))
}
