'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { isoDateSchema } from '@/lib/validation/daily'
import {
  deleteJournalEntry,
  deleteNote,
  ensureTags,
  replaceNoteLinks,
  setNoteTags,
  upsertJournalEntry,
  upsertNote,
} from '@/server/repositories/knowledge'
import { findResource, findTopic } from '@/server/repositories/learning'
import { findNote } from '@/server/repositories/knowledge'
import { extractWikiLinks } from '@/lib/knowledge/links'
import { today } from '@/lib/dates'
import { PATHS } from '@/lib/paths'
import { getDayContext } from '@/server/services/settings'
import { audited, type NoteChange } from '@/server/services/audited'
import { noteSnapshot } from '@/server/services/activity-snapshots'
import { ownedOrNull } from '@/server/services/ownership'

const optionalText = z
  .string()
  .max(200_000)
  .transform((value) => (value.trim() === '' ? null : value.trim()))
  .nullable()
  .optional()

const noteSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  bodyMd: optionalText,
  type: z.enum(['note', 'concept', 'bookmark', 'lesson']).default('note'),
  url: optionalText,
  learnedOn: isoDateSchema.nullable().optional(),
  topicId: z.uuid().nullable().optional(),
  resourceId: z.uuid().nullable().optional(),
  tags: z.array(z.string().min(1).max(60)).max(20).optional(),
})

export const saveNote = audited(
  (_result, input: unknown) => ((input as { id?: string }).id ? 'note.update' : 'note.create'),
  async (input: unknown, audit: NoteChange) => {
    const parsed = noteSchema.safeParse(input)
    if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

    const userId = await getCurrentUserId()
    const { tags: tagNames, ...values } = parsed.data

    // A lesson always carries the day it was learned, so a review of the period
    // can group it. Typing it a week later must not move it into that week.
    const learnedOn =
      values.type === 'lesson'
        ? (values.learnedOn ?? today(await getDayContext()))
        : (values.learnedOn ?? null)

    const [topicId, resourceId, before] = await Promise.all([
      ownedOrNull(userId, values.topicId ?? null, findTopic),
      ownedOrNull(userId, values.resourceId ?? null, findResource),
      // Beside them rather than after: the row as it stands is needed before
      // the upsert overwrites it, and it answers to nothing the other two ask.
      values.id ? findNote(userId, values.id) : null,
    ])
    const note = await upsertNote(userId, {
      ...values,
      bodyMd: values.bodyMd ?? null,
      url: values.url ?? null,
      learnedOn,
      topicId,
      resourceId,
    })

    // Tags and wiki-links are derived from the note itself, so saving keeps the
    // graph in step with the text (spec 13.2).
    const tags = await ensureTags(userId, tagNames ?? [])
    await setNoteTags(
      note.id,
      tags.map((tag) => tag.id),
    )
    await replaceNoteLinks(userId, note.id, extractWikiLinks(values.bodyMd ?? ''))

    audit({ current: noteSnapshot(before), request: noteSnapshot(note) })

    revalidatePath(PATHS.learning)
    revalidatePath(PATHS.reviews)
    return { ok: true as const, id: note.id }
  },
  ({ result, input }) => ({
    entityId: result.ok ? result.id : null,
    label: (input as { title?: string }).title ?? null,
  }),
)

export const removeNote = audited(
  'note.delete',
  async (input: unknown, audit: NoteChange) => {
    const id = z.string().uuid().parse(input)
    const userId = await getCurrentUserId()
    audit({ current: noteSnapshot(await deleteNote(userId, id)) })
    revalidatePath(PATHS.learning)
    return { ok: true }
  },
  ({ input }) => ({ entityId: input as string }),
)

const journalSchema = z.object({
  id: z.string().uuid().optional(),
  entryDate: isoDateSchema,
  title: optionalText,
  bodyMd: z.string().min(1).max(200_000),
  mood: z.number().int().min(1).max(10).nullable().optional(),
  tags: z.array(z.string().min(1).max(60)).max(20).optional(),
})

export async function saveJournalEntry(input: unknown) {
  const parsed = journalSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const entry = await upsertJournalEntry(await getCurrentUserId(), {
    id: parsed.data.id,
    entryDate: parsed.data.entryDate,
    title: parsed.data.title ?? null,
    bodyMd: parsed.data.bodyMd,
    mood: parsed.data.mood ?? null,
    tags: parsed.data.tags ?? null,
  })

  revalidatePath(PATHS.journal)
  revalidatePath(PATHS.home)
  return { ok: true as const, id: entry.id }
}

export async function removeJournalEntry(input: unknown) {
  const id = z.string().uuid().parse(input)
  await deleteJournalEntry(await getCurrentUserId(), id)
  revalidatePath(PATHS.journal)
  return { ok: true }
}
