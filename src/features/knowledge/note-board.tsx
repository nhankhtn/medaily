import { X } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Markdown } from '@/components/ui/markdown'
import { EmptyState } from '@/components/ui/page'
import { NoteCard, NoteEditor } from '@/features/knowledge/note-editor'
import { noteLinkTargets } from '@/lib/knowledge/links'
import { PATHS } from '@/lib/paths'
import { getKnowledgeData, getNoteDetail, type NoteView } from '@/server/services/knowledge'

/**
 * Every note, and one of them opened when the address says so. It lives beside
 * the sessions rather than on a page of its own: what you read and what you
 * wrote down about it are the same subject.
 */
export async function NoteBoard({ openedId }: { openedId?: string }) {
  const [t, data] = await Promise.all([getTranslations('knowledge'), getKnowledgeData()])
  const opened = openedId ? await getNoteDetail(openedId) : null

  // Every note on the page, so a [[link]] in any body can resolve to its id.
  const targets = noteLinkTargets(data.notes)

  return (
    <div className="space-y-4">
      {opened ? (
        <Card>
          <CardHeader
            title={opened.note.title}
            action={
              <div className="flex items-center gap-2">
                <NoteEditor
                  topics={data.topics}
                  resources={data.resources}
                  note={{
                    ...opened.note,
                    ...noteExtras(data.notes.find((n) => n.id === opened.note.id)),
                  }}
                  trigger={
                    <Button variant="outline" size="sm">
                      {t('edit')}
                    </Button>
                  }
                />
                <Button asChild variant="ghost" size="iconSm">
                  <Link href={PATHS.learningTab('notes')} aria-label={t('close')}>
                    <X className="size-4" />
                  </Link>
                </Button>
              </div>
            }
          />
          <CardBody className="space-y-3">
            <Markdown targets={targets}>{opened.note.bodyMd ?? '—'}</Markdown>

            {opened.note.url ? (
              <a
                href={opened.note.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent block truncate text-xs hover:underline"
              >
                {opened.note.url}
              </a>
            ) : null}

            <div className="border-border-base border-t pt-3">
              <p className="text-text-muted text-xs font-medium">{t('backlinks')}</p>
              {opened.backlinks.length === 0 ? (
                <p className="text-text-subtle mt-1 text-sm">{t('noBacklinks')}</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {opened.backlinks.map((link) => (
                    <li key={link.id}>
                      <Link
                        href={PATHS.note(link.id)}
                        className="hover:text-accent text-sm hover:underline"
                      >
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {data.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {data.tags.map((tag) => (
            <Badge key={tag.id}>#{tag.name}</Badge>
          ))}
        </div>
      ) : null}

      {data.notes.length === 0 ? (
        <EmptyState
          title={t('noNotes')}
          body={t('noNotesBody')}
          action={<NoteEditor topics={data.topics} resources={data.resources} />}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.notes.map((note) => (
            <li key={note.id}>
              <NoteCard
                note={note}
                targets={targets}
                topics={data.topics}
                resources={data.resources}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The button that makes a new note, for whoever is drawing the page header. */
export async function NewNoteButton() {
  const data = await getKnowledgeData()
  return <NoteEditor topics={data.topics} resources={data.resources} />
}

/**
 * The opened note comes from `getNoteDetail`, which returns the raw row; the
 * resolved names live on the list view. Falls back to empty rather than
 * guessing, so a note opened by URL still renders.
 */
function noteExtras(view: NoteView | undefined) {
  return {
    tagNames: view?.tagNames ?? [],
    topicName: view?.topicName ?? null,
    resourceTitle: view?.resourceTitle ?? null,
  }
}
