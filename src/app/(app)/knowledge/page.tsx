import { getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { EmptyState, PageHeader } from '@/components/ui/page'
import { NoteCard, NoteEditor } from '@/features/knowledge/note-editor'
import { getKnowledgeData } from '@/server/services/knowledge'

export default async function KnowledgePage() {
  const [t, data] = await Promise.all([getTranslations('knowledge'), getKnowledgeData()])

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} action={<NoteEditor />} />

      {data.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {data.tags.map((tag) => (
            <Badge key={tag.id}>#{tag.name}</Badge>
          ))}
        </div>
      ) : null}

      {data.notes.length === 0 ? (
        <EmptyState title={t('noNotes')} body={t('noNotesBody')} action={<NoteEditor />} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.notes.map((note) => (
            <li key={note.id}>
              <NoteCard note={note} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
