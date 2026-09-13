import type { ISODate } from '@/lib/dates'

export const RECURRENCE_RULES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] as const
export type RecurrenceRule = (typeof RECURRENCE_RULES)[number]

export type Recurring = {
  startsAt: Date
  endsAt: Date | null
  recurrenceRule: RecurrenceRule | null
  recurrenceUntil: ISODate | null
}

export type DateWindow = { from: Date; to: Date }

const MONTH_STEP: Record<Exclude<RecurrenceRule, 'daily' | 'weekly'>, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
}

const MAX_OCCURRENCES = 750
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Steps `count` intervals from the seed, keeping the wall-clock time.
 *
 * Month and year steps are built from calendar fields rather than by adding
 * days, so "the 31st" stays the 31st. When the target month has no such day the
 * result rolls into the next month, which `null` reports as "no occurrence this
 * period" — the iCalendar behaviour, and the reason a 29 February event appears
 * only in leap years instead of silently drifting to the 1st of March.
 */
function occurrenceAt(seed: Date, rule: RecurrenceRule, count: number): Date | null {
  if (rule === 'daily' || rule === 'weekly') {
    const next = new Date(seed)
    next.setDate(seed.getDate() + count * (rule === 'weekly' ? 7 : 1))
    return next
  }

  const day = seed.getDate()
  const next = new Date(
    seed.getFullYear(),
    seed.getMonth() + count * MONTH_STEP[rule],
    day,
    seed.getHours(),
    seed.getMinutes(),
    seed.getSeconds(),
  )

  return next.getDate() === day ? next : null
}

/**
 * The interval index whose occurrence is the last one at or before the window
 * opens, so a series that began years ago is not walked step by step. It errs
 * low — never past the window — and 0 for a series that starts inside it.
 */
function countAtOrBefore(seed: Date, rule: RecurrenceRule, from: Date): number {
  if (from <= seed) return 0

  const elapsed = from.getTime() - seed.getTime()
  const count =
    rule === 'daily'
      ? Math.floor(elapsed / MS_PER_DAY)
      : rule === 'weekly'
        ? Math.floor(elapsed / (7 * MS_PER_DAY))
        : Math.floor(monthsBetween(seed, from) / MONTH_STEP[rule])

  return Math.max(0, count - 1)
}

const monthsBetween = (from: Date, to: Date) =>
  (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())

/**
 * Every occurrence of one event inside a window, as copies carrying the shifted
 * times. A non-repeating event yields itself when it falls inside.
 */
export function expandOccurrences<T extends Recurring>(event: T, window: DateWindow): T[] {
  const { startsAt, endsAt, recurrenceRule: rule, recurrenceUntil } = event

  if (!rule) {
    return startsAt >= window.from && startsAt <= window.to ? [event] : []
  }

  const durationMs = endsAt ? endsAt.getTime() - startsAt.getTime() : null
  // `recurrence_until` is a date, so the series runs to the end of that day.
  const until = recurrenceUntil ? new Date(`${recurrenceUntil}T23:59:59`) : null
  const horizon = until && until < window.to ? until : window.to

  const out: T[] = []
  const first = countAtOrBefore(startsAt, rule, window.from)
  for (let count = first; count < first + MAX_OCCURRENCES; count++) {
    const occurrence = occurrenceAt(startsAt, rule, count)

    if (occurrence === null) continue
    if (occurrence > horizon) break
    if (occurrence < window.from) continue

    out.push({
      ...event,
      startsAt: occurrence,
      endsAt: durationMs === null ? null : new Date(occurrence.getTime() + durationMs),
    })
  }

  return out
}

export function expandAll<T extends Recurring>(events: T[], window: DateWindow): T[] {
  return events
    .flatMap((event) => expandOccurrences(event, window))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}

/**
 * RFC 5545 rule for the ICS export; quarterly is monthly with an interval. UNTIL
 * has to match the value type of DTSTART, which is a bare date for an all-day
 * event and a UTC timestamp otherwise.
 */
export function toRrule(rule: RecurrenceRule, until: ISODate | null, allDay = false): string {
  const freq = rule === 'quarterly' ? 'MONTHLY' : rule.toUpperCase()
  const interval = rule === 'quarterly' ? ';INTERVAL=3' : ''
  const day = until?.replace(/-/g, '')
  const untilPart = day ? `;UNTIL=${allDay ? day : `${day}T235959Z`}` : ''
  return `RRULE:FREQ=${freq}${interval}${untilPart}`
}
