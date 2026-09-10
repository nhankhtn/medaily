import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { JournalEntry, Note, Tag } from '@/lib/db/schema'
import { today as todayOf, type ISODate } from '@/lib/dates'
import {
  findBacklinks,
  findJournalEntries,
  findNote,
  findNoteTags,
  findNotes,
  findTags,
} from '@/server/repositories/knowledge'
import { searchEverything, type SearchHit } from '@/server/repositories/search'
export { extractWikiLinks } from '@/lib/knowledge/links'
import { dayContextOf, getSettings } from '@/server/services/settings'

export type NoteView = Note & { tagNames: string[] }

export const getKnowledgeData = cache(async (): Promise<{
  notes: NoteView[]
  tags: Tag[]
}> => {
  const userId = await getCurrentUserId()
  const [rows, tags] = await Promise.all([findNotes(userId), findTags(userId)])
  const noteTagRows = await findNoteTags(rows.map((note) => note.id))

  return {
    notes: rows.map((note) => ({
      ...note,
      tagNames: noteTagRows.filter((row) => row.noteId === note.id).map((row) => row.name),
    })),
    tags,
  }
})

export const getNoteDetail = cache(async (noteId: string) => {
  const userId = await getCurrentUserId()
  const note = await findNote(userId, noteId)
  if (!note) return null

  const backlinks = await findBacklinks(userId, note.id, note.title)
  return { note, backlinks }
})

export const getJournalData = cache(async (): Promise<{
  today: ISODate
  entries: JournalEntry[]
}> => {
  const settings = await getSettings()
  const [entries] = await Promise.all([findJournalEntries(settings.userId)])
  return { today: todayOf(dayContextOf(settings)), entries }
})

export const runSearch = cache(async (query: string): Promise<SearchHit[]> => {
  return searchEverything(await getCurrentUserId(), query)
})

