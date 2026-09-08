import { getTranslations } from 'next-intl/server'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page'
import { ResourceList } from '@/features/learning/resource-list'
import { SessionList } from '@/features/learning/session-list'
import { TimerWidget } from '@/features/learning/timer-widget'
import { getLearningData } from '@/server/services/learning'

export default async function LearningPage() {
  const [t, data] = await Promise.all([getTranslations('learning'), getLearningData()])

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} />

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
            <CardHeader title={t('byTopic')} />
            <CardBody>
              {data.byTopic.length === 0 ? (
                <p className="text-sm text-text-subtle">{t('noSessionsBody')}</p>
              ) : (
                <ul className="space-y-2">
                  {data.byTopic.slice(0, 8).map((entry) => {
                    const share = data.totalMinutes
                      ? (entry.minutes / data.totalMinutes) * 100
                      : 0
                    return (
                      <li key={entry.topicId ?? 'none'} className="flex items-center gap-2">
                        <span className="w-24 shrink-0 truncate text-sm">
                          {entry.name ?? t('noTopic')}
                        </span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <span
                            className="block h-full rounded-full bg-accent"
                            style={{ width: `${share}%` }}
                          />
                        </span>
                        <span className="w-14 shrink-0 text-right text-xs tabular-nums text-text-subtle">
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
