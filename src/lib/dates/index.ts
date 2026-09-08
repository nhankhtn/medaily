import {
  addDays as fnsAddDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subHours,
} from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

/** A calendar date with no time and no timezone: `yyyy-MM-dd`. */
export type ISODate = string

export type DayContext = {
  timezone: string
  /** Instants before this hour belong to the previous logical date (spec 20.1). */
  dayRolloverHour: number
  weekStart: 'monday' | 'sunday'
}

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isISODate(value: string): value is ISODate {
  if (!ISO_DATE_RE.test(value)) return false
  const d = parseISO(value)
  return !Number.isNaN(d.getTime()) && format(d, 'yyyy-MM-dd') === value
}

export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd')
}

/** Parses an ISO date into a Date at local midnight — safe for calendar math only. */
export function fromISODate(date: ISODate): Date {
  return parseISO(date)
}

/**
 * The logical date an instant belongs to, honouring the user's timezone and
 * rollover hour: logging at 01:30 with a 04:00 rollover files under yesterday.
 */
export function logicalDateOf(instant: Date, ctx: DayContext): ISODate {
  const zoned = toZonedTime(instant, ctx.timezone)
  return toISODate(subHours(zoned, ctx.dayRolloverHour))
}

export function today(ctx: DayContext, now: Date = new Date()): ISODate {
  return logicalDateOf(now, ctx)
}

/** True when the rollover hour makes "now" belong to the previous calendar date. */
export function isBeforeRollover(ctx: DayContext, now: Date = new Date()): boolean {
  const zoned = toZonedTime(now, ctx.timezone)
  return zoned.getHours() < ctx.dayRolloverHour
}

export function addDays(date: ISODate, amount: number): ISODate {
  return toISODate(fnsAddDays(fromISODate(date), amount))
}

export function diffDays(a: ISODate, b: ISODate): number {
  return differenceInCalendarDays(fromISODate(a), fromISODate(b))
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b
}

export function weekStartOf(date: ISODate, weekStart: DayContext['weekStart']): ISODate {
  return toISODate(
    startOfWeek(fromISODate(date), { weekStartsOn: weekStart === 'monday' ? 1 : 0 }),
  )
}

export function weekEndOf(date: ISODate, weekStart: DayContext['weekStart']): ISODate {
  return addDays(weekStartOf(date, weekStart), 6)
}

export function monthStartOf(date: ISODate): ISODate {
  return toISODate(startOfMonth(fromISODate(date)))
}

export function monthEndOf(date: ISODate): ISODate {
  return toISODate(endOfMonth(fromISODate(date)))
}

export function addMonthsISO(date: ISODate, amount: number): ISODate {
  return toISODate(addMonths(fromISODate(date), amount))
}

export function yearOf(date: ISODate): number {
  return Number(date.slice(0, 4))
}

/** ISO weekday, 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: ISODate): number {
  const day = fromISODate(date).getDay()
  return day === 0 ? 7 : day
}

export type DateRange = { start: ISODate; end: ISODate }

/** Inclusive list of dates. Guards against reversed ranges. */
export function eachDay({ start, end }: DateRange): ISODate[] {
  if (start > end) return []
  const out: ISODate[] = []
  let cursor = start
  while (cursor <= end) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}

export function rangeOfLastDays(end: ISODate, days: number): DateRange {
  return { start: addDays(end, -(days - 1)), end }
}

/** The equal-length window immediately before `range`, for period-over-period deltas. */
export function previousRange(range: DateRange): DateRange {
  const length = diffDays(range.end, range.start) + 1
  return { start: addDays(range.start, -length), end: addDays(range.start, -1) }
}

export function rangeLength(range: DateRange): number {
  return diffDays(range.end, range.start) + 1
}
