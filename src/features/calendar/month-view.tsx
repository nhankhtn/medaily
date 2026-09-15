import { getFormatter, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Card, CardBody } from '@/components/ui/card'
import { fromISODate, type ISODate } from '@/lib/dates'
import { PATHS } from '@/lib/paths'
import { cn } from '@/lib/utils'
import type { CalendarDay, CalendarItem, MonthCalendar } from '@/server/services/planning'

/** Above this the cell would grow past its row, so the rest becomes a count. */
const VISIBLE_PER_DAY = 3

export async function MonthView({ data }: { data: MonthCalendar }) {
  const [t, format] = await Promise.all([getTranslations('calendar'), getFormatter()])

  const weekdays = (data.weeks[0] ?? []).map((day) =>
    format.dateTime(fromISODate(day.date), 'weekday'),
  )

  return (
    <Card className="overflow-hidden">
      <CardBody className="p-0">
        <div className="border-border-base grid grid-cols-7 border-b">
          {weekdays.map((label, index) => (
            <div key={index} className="text-text-subtle px-2 py-2 text-center text-xs font-medium">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {data.weeks.flat().map((day) => (
            <DayCell key={day.date} day={day} today={data.today} t={t} format={format} />
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

type Localised = {
  t: Awaited<ReturnType<typeof getTranslations<'calendar'>>>
  format: Awaited<ReturnType<typeof getFormatter>>
}

function DayCell({ day, today, t, format }: { day: CalendarDay; today: ISODate } & Localised) {
  const hidden = day.items.length - VISIBLE_PER_DAY

  return (
    <Link
      href={PATHS.calendar({ view: 'week', at: day.date })}
      className={cn(
        'border-border-base hover:bg-surface-2 flex min-h-16 flex-col gap-1 border-r border-b p-1.5 transition-colors sm:min-h-28',
        '[&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0',
        !day.inMonth && 'bg-surface-2/40',
      )}
    >
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums',
          day.inMonth ? 'text-text' : 'text-text-subtle',
          day.date === today && 'bg-accent text-accent-text font-semibold',
        )}
      >
        {Number(day.date.slice(8))}
      </span>

      {/* A phone column is too narrow for titles, so it gets iOS-style dots. */}
      <span className="flex flex-wrap gap-1 px-0.5 sm:hidden">
        {day.items.slice(0, 3).map((item) => (
          <span
            key={item.key}
            className={cn(
              'size-1.5 rounded-full',
              item.kind === 'holiday'
                ? 'bg-bad'
                : item.kind === 'event'
                  ? 'bg-accent'
                  : item.kind === 'task'
                    ? item.done
                      ? 'bg-good'
                      : 'bg-warn'
                    : 'bg-border-strong',
            )}
          />
        ))}
      </span>

      <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
        {day.items.slice(0, VISIBLE_PER_DAY).map((item) => (
          <Item key={item.key} item={item} t={t} format={format} />
        ))}
        {hidden > 0 ? (
          <span className="text-text-subtle px-1 text-[11px]">{t('more', { count: hidden })}</span>
        ) : null}
      </span>
    </Link>
  )
}

function Item({ item, t, format }: { item: CalendarItem } & Localised) {
  const label = item.holidayKey
    ? t(`holidays.${item.holidayKey}`)
    : (item.title ?? (item.blockKind ? t(`kinds.${item.blockKind}`) : t('events')))

  return (
    <span
      className={cn(
        'truncate rounded px-1 text-[11px] leading-5',
        // Red, the way a Vietnamese calendar marks a day off — not a warning.
        item.kind === 'holiday'
          ? 'bg-bad-soft text-text'
          : item.kind === 'event'
            ? 'bg-accent/15 text-text'
            : item.kind === 'task'
              ? 'bg-warn-soft text-text'
              : 'bg-surface-2 text-text-muted ring-border-base ring-1 ring-inset',
        // Done is worth seeing on the grid: a month of struck-through lines is
        // the month you actually had.
        item.done && 'text-text-subtle line-through',
      )}
      title={label}
    >
      {item.at ? (
        <span className="text-text-subtle tabular-nums">{format.dateTime(item.at, 'time')} </span>
      ) : null}
      {label}
    </span>
  )
}
