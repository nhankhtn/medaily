import { X } from 'lucide-react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Markdown } from '@/components/ui/markdown'
import { EmptyState, PageHeader } from '@/components/ui/page'
import { NoteCard, NoteEditor } from '@/features/knowledge/note-editor'
import { getKnowledgeData, getNoteDetail } from '@/server/services/knowledge'

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string }>
}) {
  const [t, params, data] = await Promise.all([
    getTranslations('knowledge'),
    searchParams,
    getKnowledgeData(),
  ])

  const opened = params.note ? await getNoteDetail(params.note) : null

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} action={<NoteEditor />} />

      {opened ? (
        <Card>
          <CardHeader
            title={opened.note.title}
            action={
              <div className="flex items-center gap-2">
                <NoteEditor
                  note={{
                    ...opened.note,
                    tagNames: data.notes.find((n) => n.id === opened.note.id)?.tagNames ?? [],
                  }}
                  trigger={
                    <Button variant="outline" size="sm">
                      {t('edit')}
                    </Button>
                  }
                />
                <Button asChild variant="ghost" size="iconSm">
                  <Link href="/knowledge" aria-label={t('close')}>
                    <X className="size-4" />
                  </Link>
                </Button>
              </div>
            }
          />
          <CardBody className="space-y-3">
            <Markdown>{opened.note.bodyMd ?? '—'}</Markdown>

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
                        href={`/knowledge?note=${link.id}`}
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
