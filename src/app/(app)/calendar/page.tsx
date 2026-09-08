import { CalendarDays, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import Link from 'next/link'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { PageHeader, StatRow } from '@/components/ui/page'
import { BlockDialog, EventDialog } from '@/features/calendar/calendar-dialogs'
import { addDays, fromISODate, isISODate } from '@/lib/dates'
import { getPlanningData } from '@/server/services/planning'
import { getProjectsView } from '@/server/services/projects'

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const params = await searchParams
  const weekParam = params.week && isISODate(params.week) ? params.week : undefined

  const [t, format, data, projectData] = await Promise.all([
    getTranslations('calendar'),
    getFormatter(),
    getPlanningData(weekParam),
    getProjectsView(),
  ])

  const projects = projectData.projects.map((project) => ({ id: project.id, name: project.name }))
  const hours = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10}h`

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('title')}
        action={
          <div className="flex flex-wrap gap-2">
            <EventDialog defaultDate={data.today} />
            <BlockDialog defaultDate={data.today} projects={projects} />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="iconSm">
          <Link
            href={`/calendar?week=${addDays(data.weekStart, -7)}`}
            aria-label={t('previousWeek')}
          >
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <span className="text-sm font-medium">
          {format.dateTime(fromISODate(data.range.start), { day: 'numeric', month: 'short' })} –{' '}
          {format.dateTime(fromISODate(data.range.end), {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
        <Button asChild variant="outline" size="iconSm">
          <Link href={`/calendar?week=${addDays(data.weekStart, 7)}`} aria-label={t('nextWeek')}>
            <ChevronRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/calendar">{t('thisWeek')}</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <a href="/api/calendar.ics">
            <Download className="size-4" />
            {t('icsExport')}
          </a>
        </Button>
      </div>

      <StatRow
        items={[
          { label: t('planned'), value: hours(data.totals.planned) },
          { label: t('actual'), value: hours(data.totals.actual) },
          {
            label: t('planVsActual'),
            value:
              data.totals.planned === 0
                ? '—'
                : `${Math.round((data.totals.actual / data.totals.planned) * 100)}%`,
          },
          { label: t('events'), value: String(data.events.length) },
        ]}
      />

      <Card>
        <CardHeader title={t('planVsActual')} />
        <CardBody>
          <ul className="space-y-2">
            {data.days.map((day) => {
              const max = Math.max(day.plannedMinutes, day.actualMinutes, 60)
              return (
                <li key={day.date} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs tabular-nums text-text-muted">
                    {format.dateTime(fromISODate(day.date), { weekday: 'short', day: 'numeric' })}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className="block h-full rounded-full bg-border-strong"
                          style={{ width: `${(day.plannedMinutes / max) * 100}%` }}
                        />
                      </span>
                      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-text-subtle">
                        {hours(day.plannedMinutes)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{ width: `${(day.actualMinutes / max) * 100}%` }}
                        />
                      </span>
                      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-text">
                        {hours(day.actualMinutes)}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('events')} />
          <CardBody>
            {data.events.length === 0 ? (
              <p className="text-sm text-text-subtle">{t('noEvents')}</p>
            ) : (
              <ul className="divide-y divide-border-base">
                {data.events.map((event) => (
                  <li key={event.id} className="flex items-center gap-3 py-2">
                    <CalendarDays className="size-4 shrink-0 text-text-subtle" />
                    <span className="min-w-0 flex-1 truncate text-sm">{event.title}</span>
                    {event.location ? (
                      <span className="hidden shrink-0 text-xs text-text-subtle sm:inline">
                        {event.location}
                      </span>
                    ) : null}
                    <span className="shrink-0 text-xs tabular-nums text-text-subtle">
                      {event.allDay
                        ? format.dateTime(event.startsAt, { day: 'numeric', month: 'short' })
                        : format.dateTime(event.startsAt, {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('blocks')} />
          <CardBody>
            {data.days.every((day) => day.blocks.length === 0) ? (
              <p className="text-sm text-text-subtle">{t('noBlocks')}</p>
            ) : (
              <ul className="divide-y divide-border-base">
                {data.days.flatMap((day) =>
                  day.blocks.map((block) => (
                    <li key={block.id} className="flex items-center gap-3 py-2">
                      <span className="w-16 shrink-0 text-xs tabular-nums text-text-subtle">
                        {format.dateTime(fromISODate(day.date), { weekday: 'short' })}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums">
                        {block.startTime.slice(0, 5)}–{block.endTime.slice(0, 5)}
                      </span>
                      <Badge tone="accent">{t(`kinds.${block.kind}`)}</Badge>
                      <span className="min-w-0 flex-1 truncate text-sm text-text-muted">
                        {block.note ?? ''}
                      </span>
                    </li>
                  )),
                )}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
