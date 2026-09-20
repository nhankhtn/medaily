import Link from 'next/link'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { PageHeader, StatRow } from '@/components/ui/page'
import { AiReview } from '@/features/ai/ai-review'
import { PeriodPicker } from '@/features/reviews/period-picker'
import { ReviewEditor } from '@/features/reviews/review-editor'
import { fromISODate } from '@/lib/dates'
import { PATHS } from '@/lib/paths'
import { findLatestReport } from '@/server/services/ai'
import { getReviewView } from '@/server/services/reviews'
import { aiServiceConfigured } from '@/server/services/ai-service'

const PERIODS = ['weekly', 'monthly', 'yearly'] as const
type Period = (typeof PERIODS)[number]

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; key?: string }>
}) {
  const params = await searchParams
  const period: Period = (PERIODS as readonly string[]).includes(params.period ?? '')
    ? (params.period as Period)
    : 'weekly'

  const [t, tAi, format, view] = await Promise.all([
    getTranslations('reviews'),
    getTranslations('ai'),
    getFormatter(),
    getReviewView(period, params.key),
  ])

  // The yearly period has no AI narrative: a year of aggregates says too little.
  const aiPeriod = period === 'yearly' ? null : period
  const existingReport = aiPeriod ? await findLatestReport(aiPeriod, view.range.start) : null

  const { metrics } = view
  const label =
    period === 'yearly'
      ? view.key
      : format.dateTime(
          fromISODate(view.range.start),
          period === 'weekly' ? 'dayMonthYear' : 'monthYear',
        )

  const minutesToHours = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`

  return (
    <div className="space-y-4">
      <PageHeader title={t('title')} />

      <PeriodPicker
        period={period}
        currentKey={view.key}
        previousKey={view.previousKey}
        nextKey={view.nextKey}
        label={label}
      />

      <Card>
        <CardHeader
          title={t('numbers')}
          action={
            view.finalized ? (
              <Badge tone="good">
                {t('finalizedAt', {
                  date: format.dateTime(new Date(metrics.computedAt), 'dayMonth'),
                })}
              </Badge>
            ) : (
              <Badge>{t('draft')}</Badge>
            )
          }
        />
        <CardBody className="space-y-3">
          <StatRow
            items={[
              { label: t('daysLogged'), value: String(metrics.daysLogged) },
              {
                label: t('periodScore'),
                value: metrics.periodScore === null ? '—' : String(Math.round(metrics.periodScore)),
              },
              {
                label: t('avgEnergy'),
                value: metrics.avgEnergy === null ? '—' : String(metrics.avgEnergy),
              },
              {
                label: t('avgSleep'),
                value: metrics.avgSleepHours === null ? '—' : `${metrics.avgSleepHours}h`,
              },
            ]}
          />
          <StatRow
            items={[
              { label: t('studyTotal'), value: minutesToHours(metrics.totalStudyMinutes) },
              { label: t('deepWorkTotal'), value: minutesToHours(metrics.totalDeepWorkMinutes) },
              {
                label: t('exerciseDays'),
                value: String(metrics.exerciseDays),
                hint: minutesToHours(metrics.totalExerciseMinutes),
              },
              {
                label: t('entertainmentTotal'),
                value: minutesToHours(metrics.totalEntertainmentMinutes),
              },
            ]}
          />
          <StatRow
            items={[
              { label: t('readingTotal'), value: minutesToHours(metrics.totalReadingMinutes) },
              {
                label: t('habitRate'),
                value:
                  metrics.habitCompletionRate === null
                    ? '—'
                    : `${Math.round(metrics.habitCompletionRate * 100)}%`,
              },
              {
                label: t('bestDay'),
                value: metrics.bestDay
                  ? format.dateTime(fromISODate(metrics.bestDay.date), 'dayMonth')
                  : '—',
                hint: metrics.bestDay ? String(Math.round(metrics.bestDay.score)) : undefined,
              },
              {
                label: t('worstDay'),
                value: metrics.worstDay
                  ? format.dateTime(fromISODate(metrics.worstDay.date), 'dayMonth')
                  : '—',
                hint: metrics.worstDay ? String(Math.round(metrics.worstDay.score)) : undefined,
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t('lessons')}
          action={
            view.lessonCount > 0 ? (
              <Badge tone="accent">{t('lessonCount', { count: view.lessonCount })}</Badge>
            ) : null
          }
        />
        <CardBody>
          {view.lessonGroups.length === 0 ? (
            <p className="text-text-subtle text-sm">{t('noLessons')}</p>
          ) : (
            <ul className="space-y-4">
              {view.lessonGroups.map((group) => (
                <li key={group.tag ?? ''} className="space-y-1.5">
                  <p className="text-text-muted text-xs font-medium tracking-wide uppercase">
                    {group.tag ?? t('noLessonPlace')}
                  </p>
                  <ul className="divide-border-base divide-y">
                    {group.lessons.map((lesson) => (
                      <li
                        key={lesson.id}
                        className="flex items-baseline justify-between gap-3 py-1.5"
                      >
                        <Link
                          href={PATHS.note(lesson.id)}
                          className="hover:text-accent min-w-0 truncate text-sm"
                        >
                          {lesson.title}
                        </Link>
                        <span className="text-text-subtle shrink-0 text-xs tabular-nums">
                          {format.dateTime(fromISODate(lesson.learnedOn), 'dayMonth')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('written')} />
        <CardBody>
          <ReviewEditor view={view} />
        </CardBody>
      </Card>

      {aiPeriod ? (
        <Card>
          <CardHeader title={tAi('title')} />
          <CardBody>
            <AiReview
              period={aiPeriod}
              periodKey={view.key}
              enabled={aiServiceConfigured()}
              existing={
                existingReport
                  ? {
                      contentMd: existingReport.contentMd,
                      model: existingReport.model,
                      createdAt: existingReport.createdAt.toISOString(),
                    }
                  : null
              }
            />
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
