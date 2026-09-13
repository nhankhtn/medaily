import {
  eachDay,
  monthEndOf,
  monthStartOf,
  weekEndOf,
  weekStartOf,
  type DayContext,
  type ISODate,
} from '@/lib/dates'

/**
 * The dates a month grid shows: whole weeks, so the first and last rows spill
 * into the neighbouring months rather than leaving ragged gaps.
 */
export function monthGrid(month: ISODate, weekStart: DayContext['weekStart']): ISODate[][] {
  const first = monthStartOf(month)
  const days = eachDay({
    start: weekStartOf(first, weekStart),
    end: weekEndOf(monthEndOf(first), weekStart),
  })

  const weeks: ISODate[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

export function monthsOfYear(year: number): ISODate[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}-01`)
}
