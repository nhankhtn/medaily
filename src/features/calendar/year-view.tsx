import { getFormatter, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { fromISODate, type ISODate } from '@/lib/dates'
import { PATHS } from '@/lib/paths'
import { cn } from '@/lib/utils'
import type { CalendarItem, YearCalendar, YearDay } from '@/server/services/planning'

type Localised = {
  t: Awaited<ReturnType<typeof getTranslations<'calendar'>>>
  format: Awaited<ReturnType<typeof getFormatter>>
}

export async function YearView({ data }: { data: YearCalendar }) {
  const [t, format] = await Promise.all([getTranslations('calendar'), getFormatter()])

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.months.map((month) => (
        <Card key={month.month}>
          <CardHeader
            title={format.dateTime(fromISODate(month.month), 'month')}
            action={
              month.count > 0 ? (
                <span className="text-text-subtle text-xs">
                  {t('itemCount', { count: month.count })}
                </span>
              ) : null
            }
          />
          <CardBody className="pt-0">
            <div className="grid grid-cols-7 gap-0.5">
              {(month.weeks[0] ?? []).map((day) => (
                <span
                  key={day.date}
                  className="text-text-subtle pb-1 text-center text-[10px] font-medium"
                >
                  {format.dateTime(fromISODate(day.date), 'weekdayNarrow')}
                </span>
              ))}

              {month.weeks.flat().map((day, index) => (
                <Day
                  key={day.date}
                  day={day}
                  column={index % 7}
                  today={data.today}
                  t={t}
                  format={format}
                />
              ))}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  )
}

/**
 * A hover card hanging off a cell in the last column of the rightmost month
 * would run off the page, so the two columns at each edge anchor to their own
 * side instead of centring.
 */
function anchorOf(column: number): string {
  if (column <= 1) return 'left-0'
  if (column >= 5) return 'right-0'
  return 'left-1/2 -translate-x-1/2'
}

function Day({
  day,
  column,
  today,
  t,
  format,
}: { day: YearDay; column: number; today: ISODate } & Localised) {
  if (!day.inMonth) return <span aria-hidden />

  const holiday = day.items.some((item) => item.kind === 'holiday')
  // A day of nothing but things to do is worth telling apart from a day with
  // something booked in it.
  const onlyTasks = day.items.length > 0 && day.items.every((item) => item.kind === 'task')
  const hidden = day.count - day.items.length

  return (
    // The same wrapper whether or not there is anything to show, so every cell
    // in the grid measures the same.
    <span className="group relative">
      <Link
        href={PATHS.calendar({ view: 'week', at: day.date })}
        className={cn(
          'hover:bg-surface-2 relative flex aspect-square items-center justify-center rounded text-[11px] tabular-nums transition-colors',
          day.date === today ? 'bg-accent text-accent-text font-semibold' : 'text-text-muted',
          day.count > 0 && day.date !== today && 'text-text font-semibold',
        )}
      >
        {Number(day.date.slice(8))}
        {day.count > 0 ? (
          <span
            className={cn(
              'absolute bottom-0.5 size-1 rounded-full',
              day.date === today
                ? 'bg-accent-text'
                : holiday
                  ? 'bg-bad'
                  : onlyTasks
                    ? 'bg-warn'
                    : 'bg-accent',
            )}
          />
        ) : null}
      </Link>

      {/*
       * Hover only, and CSS only. A year is 365 cells; anything that mounted a
       * listener per cell would cost more than the affordance is worth, and a
       * tap already opens the week.
       */}
      {day.count === 0 ? null : (
        <span
          role="tooltip"
          className={cn(
            'border-border-strong bg-surface pointer-events-none absolute bottom-full z-20 mb-1 hidden w-max max-w-44 flex-col gap-0.5 rounded-[var(--radius)] border p-2 text-left shadow-lg group-hover:flex',
            anchorOf(column),
          )}
        >
          <span className="text-text-subtle text-[10px] font-medium">
            {format.dateTime(fromISODate(day.date), 'dayMonth')}
          </span>
          {day.items.map((item) => (
            <span
              key={item.key}
              className={cn(
                'truncate text-[11px] leading-4',
                item.done ? 'text-text-subtle line-through' : 'text-text',
              )}
            >
              {item.at ? (
                <span className="text-text-subtle tabular-nums">
                  {format.dateTime(item.at, 'time')}{' '}
                </span>
              ) : null}
              {labelOf(item, t)}
            </span>
          ))}
          {hidden > 0 ? (
            <span className="text-text-subtle text-[10px]">{t('more', { count: hidden })}</span>
          ) : null}
        </span>
      )}
    </span>
  )
}

function labelOf(item: CalendarItem, t: Localised['t']): string {
  if (item.holidayKey) return t(`holidays.${item.holidayKey}`)
  return item.title ?? (item.blockKind ? t(`kinds.${item.blockKind}`) : t('events'))
}
