import { getFormatter, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { fromISODate, type ISODate } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { YearCalendar } from '@/server/services/planning'

export async function YearView({ data }: { data: YearCalendar }) {
  const [t, format] = await Promise.all([getTranslations('calendar'), getFormatter()])

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.months.map((month) => (
        <Card key={month.month}>
          <CardHeader
            title={format.dateTime(fromISODate(month.month), { month: 'long' })}
            action={
              month.count > 0 ? (
                <span className="text-xs text-text-subtle">
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
                  className="pb-1 text-center text-[10px] font-medium text-text-subtle"
                >
                  {format.dateTime(fromISODate(day.date), { weekday: 'narrow' })}
                </span>
              ))}

              {month.weeks.flat().map((day) => (
                <Day key={day.date} {...day} today={data.today} />
              ))}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  )
}

function Day({
  date,
  inMonth,
  count,
  today,
}: {
  date: ISODate
  inMonth: boolean
  count: number
  today: ISODate
}) {
  if (!inMonth) return <span aria-hidden />

  return (
    <Link
      href={`/calendar?view=week&at=${date}`}
      className={cn(
        'relative flex aspect-square items-center justify-center rounded text-[11px] tabular-nums transition-colors hover:bg-surface-2',
        date === today ? 'bg-accent font-semibold text-accent-text' : 'text-text-muted',
        count > 0 && date !== today && 'font-semibold text-text',
      )}
    >
      {Number(date.slice(8))}
      {count > 0 ? (
        <span
          className={cn(
            'absolute bottom-0.5 size-1 rounded-full',
            date === today ? 'bg-accent-text' : 'bg-accent',
          )}
        />
      ) : null}
    </Link>
  )
}
