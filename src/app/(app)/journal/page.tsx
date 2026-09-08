import { getFormatter, getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { EmptyState, PageHeader } from '@/components/ui/page'
import { JournalEditor } from '@/features/journal/journal-editor'
import { fromISODate } from '@/lib/dates'
import { getJournalData } from '@/server/services/knowledge'

export default async function JournalPage() {
  const [t, format, data] = await Promise.all([
    getTranslations('journal'),
    getFormatter(),
    getJournalData(),
  ])

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('title')}
        action={<JournalEditor today={data.today} />}
      />

      {data.entries.length === 0 ? (
        <EmptyState
          title={t('noEntries')}
          body={t('noEntriesBody')}
          action={<JournalEditor today={data.today} />}
        />
      ) : (
        <ul className="space-y-3">
          {data.entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-[var(--radius)] border border-border-base bg-surface p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-medium">
                  {entry.title ??
                    format.dateTime(fromISODate(entry.entryDate), {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                </h2>
                <div className="flex items-center gap-2">
                  {entry.mood ? <Badge tone="accent">{entry.mood}/10</Badge> : null}
                  <span className="text-xs tabular-nums text-text-subtle">
                    {format.dateTime(fromISODate(entry.entryDate), {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <JournalEditor
                    today={data.today}
                    entry={entry}
                    trigger={
                      <Button variant="ghost" size="sm" className="h-7 px-2">
                        ···
                      </Button>
                    }
                  />
                </div>
              </div>

              <div className="mt-2">
                <Markdown>{entry.bodyMd}</Markdown>
              </div>

              {entry.tags && entry.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {entry.tags.map((tag) => (
                    <Badge key={tag}>#{tag}</Badge>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
