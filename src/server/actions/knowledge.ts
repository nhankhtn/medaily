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
import { extractWikiLinks } from '@/lib/knowledge/links'

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
  type: z.enum(['note', 'concept', 'bookmark']).default('note'),
  url: optionalText,
  tags: z.array(z.string().min(1).max(60)).max(20).optional(),
})

export async function saveNote(input: unknown) {
  const parsed = noteSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const userId = await getCurrentUserId()
  const { tags: tagNames, ...values } = parsed.data

  const note = await upsertNote(userId, {
    ...values,
    bodyMd: values.bodyMd ?? null,
    url: values.url ?? null,
  })

  // Tags and wiki-links are derived from the note itself, so saving keeps the
  // graph in step with the text (spec 13.2).
  const tags = await ensureTags(userId, tagNames ?? [])
  await setNoteTags(note.id, tags.map((tag) => tag.id))
  await replaceNoteLinks(userId, note.id, extractWikiLinks(values.bodyMd ?? ''))

  revalidatePath('/knowledge')
  return { ok: true as const, id: note.id }
}

export async function removeNote(input: unknown) {
  const id = z.string().uuid().parse(input)
  await deleteNote(await getCurrentUserId(), id)
  revalidatePath('/knowledge')
  return { ok: true }
}

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

  revalidatePath('/journal')
  revalidatePath('/')
  return { ok: true as const, id: entry.id }
}

export async function removeJournalEntry(input: unknown) {
  const id = z.string().uuid().parse(input)
  await deleteJournalEntry(await getCurrentUserId(), id)
  revalidatePath('/journal')
  return { ok: true }
}
