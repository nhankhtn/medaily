import { CalendarDays, ChevronLeft, ChevronRight, Download, Repeat } from 'lucide-react'
import Link from 'next/link'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { PageHeader, StatRow } from '@/components/ui/page'
import { BlockDialog, EventDialog } from '@/features/calendar/calendar-dialogs'
import { Markdown } from '@/components/ui/markdown'
import { DayTasks } from '@/features/calendar/day-tasks'
import { QuickTask } from '@/features/calendar/quick-task'
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
import { holidaysIn, type Holiday } from '@/lib/planning/holidays'
import { getDayPlan } from '@/server/services/day-plan'
import { getMonthCalendar, getPlanningData, getYearCalendar } from '@/server/services/planning'
import { getProjectsView } from '@/server/services/projects'
import { getDayContext } from '@/server/services/settings'
import { PATHS } from '@/lib/paths'

// The day comes first and is the default: a calendar you open to plan
// today is more use than one you open to look at a grid.
const VIEWS = ['day', 'week', 'month', 'year'] as const

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; at?: string; week?: string }>
}) {
  const params = await searchParams
  // `?week=` is the older link shape, and still means the week holding that date.
  const requested = params.at ?? params.week
  const anchor = requested && isISODate(requested) ? requested : undefined
  const view = VIEWS.find((candidate) => candidate === params.view) ?? 'day'

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
        <nav className="glass flex rounded-full p-0.5">
          {VIEWS.map((candidate) => (
            <Link
              key={candidate}
              href={PATHS.calendar({ view: candidate, at: anchor })}
              aria-current={candidate === view ? 'page' : undefined}
              className={cn(
                'rounded-full px-3 py-1 text-sm transition-colors',
                candidate === view
                  ? 'glass-strong font-medium text-text'
                  : 'text-text-muted hover:text-text',
              )}
            >
              {t(`views.${candidate}`)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          {view === 'day' ? (
            <DayBar date={anchor ?? today} today={today} />
          ) : view === 'week' ? (
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

      {view === 'day' ? (
        <DayView date={anchor ?? today} today={today} projects={projects} />
      ) : view === 'week' ? (
        <WeekView anchor={anchor} />
      ) : view === 'month' ? (
        <Month anchor={anchor ?? today} />
      ) : (
        <Year year={Number((anchor ?? today).slice(0, 4))} />
      )}
    </div>
  )
}

/**
 * The days the country keeps, when the window on screen holds any. Computed
 * from the date, so there is nothing to add and nothing to keep up to date.
 */
async function Holidays({ holidays }: { holidays: Holiday[] }) {
  if (holidays.length === 0) return null

  const [t, format] = await Promise.all([getTranslations('calendar'), getFormatter()])

  return (
    <ul className="flex flex-wrap gap-2">
      {holidays.map((holiday) => (
        <li
          key={`${holiday.key}:${holiday.date}`}
          className="bg-bad-soft flex items-center gap-2 rounded-full px-3 py-1 text-xs"
        >
          <span className="font-medium">{t(`holidays.${holiday.key}`)}</span>
          <span className="text-text-muted tabular-nums">
            {format.dateTime(fromISODate(holiday.date), 'dayMonth')}
          </span>
          {holiday.off ? <span className="text-text-muted">· {t('dayOff')}</span> : null}
        </li>
      ))}
    </ul>
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
        {format.dateTime(fromISODate(data.range.start), 'dayMonth')} –{' '}
        {format.dateTime(fromISODate(data.range.end), 'dayMonthYear')}
      </span>
      <Step
        href={PATHS.calendar({ view: 'week', at: addDays(data.weekStart, 7) })}
        label={t('nextWeek')}
      />
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
        {format.dateTime(fromISODate(month), 'monthYear')}
      </span>
      <Step
        href={PATHS.calendar({ view: 'month', at: addMonthsISO(month, 1) })}
        label={t('nextMonth')}
      />
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
      <Step
        href={PATHS.calendar({ view: 'year', at: `${year + 1}-01-01` })}
        label={t('nextYear')}
      />
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
        <p className="text-text-subtle text-sm">{t('nothingThisMonth')}</p>
      ) : null}
    </div>
  )
}

async function Year({ year }: { year: number }) {
  const [t, data] = await Promise.all([getTranslations('calendar'), getYearCalendar(year)])

  return (
    <div className="space-y-4">
      {data.count === 0 ? <p className="text-text-subtle text-sm">{t('nothingThisYear')}</p> : null}
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
      <Holidays holidays={data.holidays} />

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
                  <span className="text-text-muted w-20 shrink-0 text-xs tabular-nums">
                    {format.dateTime(fromISODate(day.date), 'weekdayDay')}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-surface-2 h-2 flex-1 overflow-hidden rounded-full">
                        <span
                          className="bg-border-strong block h-full rounded-full"
                          style={{ width: `${(day.plannedMinutes / max) * 100}%` }}
                        />
                      </span>
                      <span className="text-text-subtle w-12 shrink-0 text-right text-xs tabular-nums">
                        {hours(day.plannedMinutes)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-surface-2 h-2 flex-1 overflow-hidden rounded-full">
                        <span
                          className="bg-accent block h-full rounded-full"
                          style={{ width: `${(day.actualMinutes / max) * 100}%` }}
                        />
                      </span>
                      <span className="text-text w-12 shrink-0 text-right text-xs tabular-nums">
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

      <Card>
        <CardHeader title={t('tasks')} />
        <CardBody>
          {data.days.every((day) => day.tasks.length === 0) ? (
            <p className="text-text-subtle text-sm">{t('noTasksThisWeek')}</p>
          ) : (
            <ul className="divide-border-base divide-y">
              {data.days
                .filter((day) => day.tasks.length > 0)
                .map((day) => (
                  <li key={day.date} className="py-2 first:pt-0 last:pb-0">
                    <Link
                      href={PATHS.calendar({ view: 'day', at: day.date })}
                      className="text-text-subtle hover:text-text text-xs font-medium"
                    >
                      {format.dateTime(fromISODate(day.date), 'weekdayDay')}
                    </Link>
                    <DayTasks tasks={day.tasks} />
                  </li>
                ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('events')} />
          <CardBody>
            {data.events.length === 0 ? (
              <p className="text-text-subtle text-sm">{t('noEvents')}</p>
            ) : (
              <ul className="divide-border-base divide-y">
                {data.events.map((event) => (
                  <li key={event.key} className="flex items-center gap-3 py-2">
                    {event.recurrenceRule ? (
                      <Repeat
                        className="text-text-subtle size-4 shrink-0"
                        aria-label={t(`repeats.${event.recurrenceRule}`)}
                      />
                    ) : (
                      <CalendarDays className="text-text-subtle size-4 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm">{event.title}</span>
                    {event.location ? (
                      <span className="text-text-subtle hidden shrink-0 text-xs sm:inline">
                        {event.location}
                      </span>
                    ) : null}
                    <span className="text-text-subtle shrink-0 text-xs tabular-nums">
                      {event.allDay
                        ? format.dateTime(event.startsAt, 'weekdayDayMonth')
                        : format.dateTime(event.startsAt, 'weekdayDayMonthTime')}
                    </span>
                    <EventDialog defaultDate={event.series.date} event={event.series} />
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
              <p className="text-text-subtle text-sm">{t('noBlocks')}</p>
            ) : (
              <ul className="divide-border-base divide-y">
                {data.days.flatMap((day) =>
                  day.blocks.map((block) => (
                    <li key={block.id} className="flex items-center gap-3 py-2">
                      <span className="text-text-subtle w-16 shrink-0 text-xs tabular-nums">
                        {format.dateTime(fromISODate(day.date), 'weekday')}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums">
                        {block.startTime.slice(0, 5)}–{block.endTime.slice(0, 5)}
                      </span>
                      <Badge tone="accent">{t(`kinds.${block.kind}`)}</Badge>
                      <span className="text-text-muted min-w-0 flex-1 truncate text-sm">
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

async function DayBar({ date, today }: { date: ISODate; today: ISODate }) {
  const [t, format] = await Promise.all([getTranslations('calendar'), getFormatter()])

  return (
    <>
      <Step
        back
        href={PATHS.calendar({ view: 'day', at: addDays(date, -1) })}
        label={t('previousDay')}
      />
      <span className="px-1 text-sm font-medium whitespace-nowrap">
        {format.dateTime(fromISODate(date), 'weekdayDayMonth')}
      </span>
      <Step href={PATHS.calendar({ view: 'day', at: addDays(date, 1) })} label={t('nextDay')} />

      {date === today ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={PATHS.calendar({ view: 'day', at: addDays(today, 1) })}>
            {t('planTomorrow')}
          </Link>
        </Button>
      ) : (
        <Button asChild variant="ghost" size="sm">
          <Link href={PATHS.calendar({ view: 'day' })}>{t('backToToday')}</Link>
        </Button>
      )}
    </>
  )
}

/**
 * One day, plan and all: what is open, what time is set aside for it, what is
 * happening, and what yesterday said would matter.
 */
async function DayView({
  date,
  today,
  projects,
}: {
  date: ISODate
  today: ISODate
  projects: { id: string; name: string }[]
}) {
  const [t, format, plan] = await Promise.all([
    getTranslations('calendar'),
    getFormatter(),
    getDayPlan(date),
  ])

  return (
    <div className="space-y-4">
      <Holidays holidays={holidaysIn({ start: date, end: date })} />

      {plan.priorityFromYesterday && date === today ? (
        <section className="border-accent bg-accent-soft/40 rounded-[var(--radius)] border p-4">
          <p className="text-text-muted text-xs font-medium">{t('fromYesterday')}</p>
          <div className="mt-1">
            <Markdown>{plan.priorityFromYesterday}</Markdown>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader title={t('tasks')} action={<QuickTask date={date} />} />
            <CardBody>
              {plan.tasks.length === 0 ? (
                <p className="text-text-subtle text-sm">{t('noTasks')}</p>
              ) : (
                <DayTasks tasks={plan.tasks} />
              )}
            </CardBody>
          </Card>

          {plan.unscheduled.length > 0 ? (
            <Card>
              <CardHeader title={t('unscheduled')} />
              <CardBody>
                <p className="text-text-subtle mb-2 text-xs">{t('unscheduledHint')}</p>
                <DayTasks tasks={plan.unscheduled} scheduleTo={date} />
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title={t('blocks')}
              action={<BlockDialog defaultDate={date} projects={projects} />}
            />
            <CardBody>
              {plan.blocks.length === 0 ? (
                <p className="text-text-subtle text-sm">{t('noBlocks')}</p>
              ) : (
                <ul className="divide-border-base divide-y">
                  {plan.blocks.map((block) => (
                    <li key={block.id} className="flex items-center gap-3 py-2">
                      <span className="text-text-subtle w-24 shrink-0 text-xs tabular-nums">
                        {block.startTime.slice(0, 5)}–{block.endTime.slice(0, 5)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {block.note ?? t(`kinds.${block.kind}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('reminders')} />
            <CardBody>
              {plan.reminders.length === 0 ? (
                <p className="text-text-subtle text-sm">{t('noReminders')}</p>
              ) : (
                <ul className="divide-border-base divide-y">
                  {plan.reminders.map((reminder) => (
                    <li key={reminder.id} className="flex items-center gap-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-sm">{reminder.title}</span>
                      <span className="text-text-subtle shrink-0 text-xs tabular-nums">
                        {format.dateTime(fromISODate(reminder.dueOn), 'dayMonth')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
