import { getTranslations } from 'next-intl/server'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { PageHeader, TabNav } from '@/components/ui/page'
import { NewNoteButton, NoteBoard } from '@/features/knowledge/note-board'
import { ResourceList } from '@/features/learning/resource-list'
import { SessionList } from '@/features/learning/session-list'
import { TimerWidget } from '@/features/learning/timer-widget'
import { TopicManager } from '@/features/learning/topic-manager'
import { PATHS, type LearningTab } from '@/lib/paths'
import { getLearningData } from '@/server/services/learning'

export default async function LearningPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; note?: string }>
}) {
  const [params, t] = await Promise.all([searchParams, getTranslations('learning')])
  const tab: LearningTab = params.tab === 'notes' ? 'notes' : 'sessions'

  const tabs = (['sessions', 'notes'] satisfies LearningTab[]).map((key) => ({
    key,
    label: t(`tabs.${key}`),
    href: PATHS.learningTab(key),
  }))

  // The two tabs read different things, so each one asks for only its own.
  if (tab === 'notes') {
    return (
      <div className="space-y-4">
        <PageHeader title={t('title')} action={<NewNoteButton />} />
        <TabNav tabs={tabs} current={tab} />
        <NoteBoard openedId={params.note} />
      </div>
    )
  }

  const data = await getLearningData()

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} />
      <TabNav tabs={tabs} current={tab} />

      <Card>
        <CardHeader title={t('timer')} />
        <CardBody>
          <TimerWidget
            key={data.timer?.startedAt ?? 'idle'}
            timer={data.timer}
            topics={data.topics}
            projects={data.projects}
          />
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t('sessions')} />
          <CardBody>
            <SessionList
              sessions={data.sessions}
              topics={data.topics}
              projects={data.projects}
              today={data.today}
            />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title={t('byTopic')} action={<TopicManager topics={data.topics} />} />
            <CardBody>
              {data.byTopic.length === 0 ? (
                <p className="text-text-subtle text-sm">{t('noSessionsBody')}</p>
              ) : (
                <ul className="space-y-2">
                  {data.byTopic.slice(0, 8).map((entry) => {
                    const share = data.totalMinutes ? (entry.minutes / data.totalMinutes) * 100 : 0
                    return (
                      <li key={entry.topicId ?? 'none'} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 truncate text-sm">
                          {entry.name ?? t('noTopic')}
                        </span>
                        <span className="bg-surface-2 h-2 flex-1 overflow-hidden rounded-full">
                          <span
                            className="bg-accent block h-full rounded-full"
                            style={{ width: `${share}%` }}
                          />
                        </span>
                        <span className="text-text-subtle w-14 shrink-0 text-right text-xs tabular-nums">
                          {Math.round(entry.minutes / 60)}h
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('resources')} />
            <CardBody>
              <ResourceList resources={data.resources} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
