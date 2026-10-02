'use client'

import { Snowflake } from 'lucide-react'
import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import { fromISODate, type ISODate } from '@/lib/dates'
import type { TrailDay } from '@/lib/daily/trail'
import { PATHS } from '@/lib/paths'
import { cn } from '@/lib/utils'
import { setDayDirection, useDayLogged } from './day-events'

/**
 * The last seven days as dots: filled when logged, an outline when missed,
 * frost where the grace day held the streak. Each one is a link to its day.
 */
export function DayTrail({
  trail,
  date,
  today,
}: {
  trail: TrailDay[]
  date: ISODate
  today: ISODate
}) {
  const t = useTranslations('daily.trail')
  const format = useFormatter()
  const todayServer = trail.at(-1)?.state === 'logged'
  const todayLogged = useDayLogged(today, todayServer)

  return (
    <ol className="flex items-center gap-1.5" aria-label={t('label')}>
      {trail.map((day) => {
        const state = day.date === today ? (todayLogged ? 'logged' : 'pending') : day.state
        const selected = day.date === date
        return (
          <li key={day.date}>
            <Link
              href={day.date === today ? PATHS.daily : PATHS.dailyOn(day.date)}
              onClick={() => setDayDirection(day.date > date ? 1 : day.date < date ? -1 : 0)}
              aria-current={selected ? 'date' : undefined}
              aria-label={`${format.dateTime(fromISODate(day.date), 'weekdayDayMonth')} · ${t(state)}`}
              className={cn(
                'flex w-7 flex-col items-center gap-1 rounded-full py-1 transition-colors',
                selected ? 'bg-accent-soft' : 'hover:bg-surface-2',
              )}
            >
              <span className="text-text-subtle text-[10px] leading-none">
                {format.dateTime(fromISODate(day.date), 'weekdayNarrow')}
              </span>
              <span
                aria-hidden
                className={cn(
                  'flex size-3 items-center justify-center rounded-full transition-[background-color,transform] duration-300',
                  state === 'logged' && 'bg-accent daily-pop',
                  state === 'missed' && 'border-border-strong border-[1.5px]',
                  state === 'pending' && 'border-accent border-[1.5px] border-dashed',
                  state === 'frozen' && 'text-accent',
                )}
              >
                {state === 'frozen' ? <Snowflake className="size-3" /> : null}
              </span>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}
