import { CalendarDays, ChevronLeft, ChevronRight, Download, Repeat } from 'lucide-react'
import Link from 'next/link'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { PageHeader, StatRow } from '@/components/ui/page'
import { BlockDialog, EventDialog } from '@/features/calendar/calendar-dialogs'
import { MonthView } from '@/features/calendar/month-view'
import { YearView } from '@/features/calendar/year-view'
import {
  addDays,
  addMonthsISO,
  fromISODate,
  isISODate,
  monthStartOf,
  today as todayOf,
  type ISODate,
} from '@/lib/dates'
import { cn } from '@/lib/utils'
import { getMonthCalendar, getPlanningData, getYearCalendar } from '@/server/services/planning'
import { getProjectsView } from '@/server/services/projects'
import { getDayContext } from '@/server/services/settings'
import { PATHS } from '@/lib/paths'

const VIEWS = ['week', 'month', 'year'] as const

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; at?: string; week?: string }>
}) {
  const params = await searchParams
  // `?week=` is the older link shape, and still means the week holding that date.
  const requested = params.at ?? params.week
  const anchor = requested && isISODate(requested) ? requested : undefined
  const view = VIEWS.find((candidate) => candidate === params.view) ?? 'week'

  const [t, projectData, today] = await Promise.all([
    getTranslations('calendar'),
    getProjectsView(),
    getDayContext().then((ctx) => todayOf(ctx)),
  ])
  const projects = projectData.projects.map((project) => ({ id: project.id, name: project.name }))

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('title')}
        action={
          <div className="flex flex-wrap gap-2">
            <EventDialog defaultDate={anchor ?? today} />
            <BlockDialog defaultDate={anchor ?? today} projects={projects} />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex rounded-full border border-border-base bg-surface-2 p-0.5">
          {VIEWS.map((candidate) => (
            <Link
              key={candidate}
              href={PATHS.calendar({ view: candidate, at: anchor })}
              aria-current={candidate === view ? 'page' : undefined}
              className={cn(
                'rounded-full px-3 py-1 text-sm transition-colors',
                candidate === view
                  ? 'bg-surface font-medium text-text shadow-[var(--shadow-card)]'
                  : 'text-text-muted hover:text-text',
              )}
            >
              {t(`views.${candidate}`)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {view === 'week' ? (
            <WeekBar anchor={anchor} />
          ) : view === 'month' ? (
            <MonthBar anchor={anchor ?? today} />
          ) : (
            <YearBar year={Number((anchor ?? today).slice(0, 4))} />
          )}
        </div>

        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <a href={PATHS.api.calendarIcs}>
            <Download className="size-4" />
            {t('icsExport')}
          </a>
        </Button>
      </div>

      {view === 'week' ? (
        <WeekView anchor={anchor} />
      ) : view === 'month' ? (
        <Month anchor={anchor ?? today} />
      ) : (
        <Year year={Number((anchor ?? today).slice(0, 4))} />
      )}
    </div>
  )
}

function Step({ href, label, back }: { href: string; label: string; back?: boolean }) {
  return (
    <Button asChild variant="outline" size="iconSm">
      <Link href={href} aria-label={label}>
        {back ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
      </Link>
    </Button>
  )
}

async function WeekBar({ anchor }: { anchor?: ISODate }) {
  const [t, format, data] = await Promise.all([
    getTranslations('calendar'),
    getFormatter(),
    getPlanningData(anchor),
  ])

  return (
    <>
      <Step
        back
        href={PATHS.calendar({ view: 'week', at: addDays(data.weekStart, -7) })}
        label={t('previousWeek')}
      />
      <span className="px-1 text-sm font-medium whitespace-nowrap">
        {format.dateTime(fromISODate(data.range.start), { day: 'numeric', month: 'short' })} –{' '}
        {format.dateTime(fromISODate(data.range.end), {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </span>
      <Step href={PATHS.calendar({ view: 'week', at: addDays(data.weekStart, 7) })} label={t('nextWeek')} />
      <Button asChild variant="ghost" size="sm">
        <Link href={PATHS.calendar({ view: 'week' })}>{t('thisWeek')}</Link>
      </Button>
    </>
  )
}

async function MonthBar({ anchor }: { anchor: ISODate }) {
  const [t, format] = await Promise.all([getTranslations('calendar'), getFormatter()])
  const month = monthStartOf(anchor)

  return (
    <>
      <Step
        back
        href={PATHS.calendar({ view: 'month', at: addMonthsISO(month, -1) })}
        label={t('previousMonth')}
      />
      <span className="px-1 text-sm font-medium whitespace-nowrap">
        {format.dateTime(fromISODate(month), { month: 'long', year: 'numeric' })}
      </span>
      <Step href={PATHS.calendar({ view: 'month', at: addMonthsISO(month, 1) })} label={t('nextMonth')} />
      <Button asChild variant="ghost" size="sm">
        <Link href={PATHS.calendar({ view: 'month' })}>{t('thisMonth')}</Link>
      </Button>
    </>
  )
}

async function YearBar({ year }: { year: number }) {
  const t = await getTranslations('calendar')

  return (
    <>
      <Step
        back
        href={PATHS.calendar({ view: 'year', at: `${year - 1}-01-01` })}
        label={t('previousYear')}
      />
      <span className="px-1 text-sm font-medium tabular-nums">{year}</span>
      <Step href={PATHS.calendar({ view: 'year', at: `${year + 1}-01-01` })} label={t('nextYear')} />
      <Button asChild variant="ghost" size="sm">
        <Link href={PATHS.calendar({ view: 'year' })}>{t('thisYear')}</Link>
      </Button>
    </>
  )
}

async function Month({ anchor }: { anchor: ISODate }) {
  const [t, data] = await Promise.all([getTranslations('calendar'), getMonthCalendar(anchor)])

  return (
    <div className="space-y-4">
      <MonthView data={data} />
      {data.count === 0 ? (
        <p className="text-sm text-text-subtle">{t('nothingThisMonth')}</p>
      ) : null}
    </div>
  )
}

async function Year({ year }: { year: number }) {
  const [t, data] = await Promise.all([getTranslations('calendar'), getYearCalendar(year)])

  return (
    <div className="space-y-4">
      {data.count === 0 ? (
        <p className="text-sm text-text-subtle">{t('nothingThisYear')}</p>
      ) : null}
      <YearView data={data} />
    </div>
  )
}

async function WeekView({ anchor }: { anchor?: ISODate }) {
  const [t, format, data] = await Promise.all([
    getTranslations('calendar'),
    getFormatter(),
    getPlanningData(anchor),
  ])

  const hours = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10}h`

  return (
    <div className="space-y-4">
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
                  <li key={event.key} className="flex items-center gap-3 py-2">
                    {event.recurrenceRule ? (
                      <Repeat
                        className="size-4 shrink-0 text-text-subtle"
                        aria-label={t(`repeats.${event.recurrenceRule}`)}
                      />
                    ) : (
                      <CalendarDays className="size-4 shrink-0 text-text-subtle" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">{event.title}</span>
                    {event.location ? (
                      <span className="hidden shrink-0 text-xs text-text-subtle sm:inline">
                        {event.location}
                      </span>
                    ) : null}
                    <span className="shrink-0 text-xs tabular-nums text-text-subtle">
                      {event.allDay
                        ? format.dateTime(event.startsAt, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })
                        : format.dateTime(event.startsAt, {
                            weekday: 'short',
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
