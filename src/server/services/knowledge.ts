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
import { findResources, findTopics } from '@/server/repositories/learning'
import { searchEverything, type SearchHit } from '@/server/repositories/search'
export { extractWikiLinks } from '@/lib/knowledge/links'
import { dayContextOf, getSettings } from '@/server/services/settings'

/** Names resolved here so a card can show what a note is filed under. */
export type NoteView = Note & {
  tagNames: string[]
  topicName: string | null
  resourceTitle: string | null
}

/** What the editor's two pickers offer. Archived ones are already excluded. */
export type NoteFilingOptions = {
  topics: { id: string; name: string }[]
  resources: { id: string; title: string }[]
}

export const getKnowledgeData = cache(async (): Promise<
  { notes: NoteView[]; tags: Tag[] } & NoteFilingOptions
> => {
  const userId = await getCurrentUserId()
  const [rows, tags, topicRows, resourceRows] = await Promise.all([
    findNotes(userId),
    findTags(userId),
    findTopics(userId),
    findResources(userId),
  ])
  const noteTagRows = await findNoteTags(rows.map((note) => note.id))

  // Both lists exclude archived rows, so a note filed under a topic that was
  // later put away keeps its `topic_id` but shows no name. That matches the
  // rest of the app — a focus session under an archived topic reads the same
  // way — and the link is still there if the topic comes back.
  const topicName = new Map(topicRows.map((topic) => [topic.id, topic.name]))
  const resourceTitle = new Map(resourceRows.map((resource) => [resource.id, resource.title]))

  return {
    notes: rows.map((note) => ({
      ...note,
      tagNames: noteTagRows.filter((row) => row.noteId === note.id).map((row) => row.name),
      topicName: note.topicId ? (topicName.get(note.topicId) ?? null) : null,
      resourceTitle: note.resourceId ? (resourceTitle.get(note.resourceId) ?? null) : null,
    })),
    tags,
    topics: topicRows.map((topic) => ({ id: topic.id, name: topic.name })),
    resources: resourceRows.map((resource) => ({ id: resource.id, title: resource.title })),
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

