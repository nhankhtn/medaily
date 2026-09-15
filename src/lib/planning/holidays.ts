import { addDays, type DateRange, type ISODate } from '@/lib/dates'
import { fromLunar } from '@/lib/planning/lunar'

/**
 * The days the country keeps, worked out from the date rather than stored.
 *
 * Nothing is written to the database: a holiday is the same for everyone and
 * the same every year, so a row per user per year would be duplication that
 * goes stale and can be deleted by accident. `holidaysIn` computes them for
 * whatever window is on screen.
 *
 * `off` marks a day off work under the Labour Code. The rest are days people
 * mark without the day off. The Code also grants extra days around Tết and
 * National Day, but the government announces which ones each year — that is a
 * decision, not a calculation, so those are left to be added by hand.
 */
export type Holiday = {
  key: HolidayKey
  date: ISODate
  off: boolean
}

/**
 * A rule that did not always exist. The year view reaches back, so a day only
 * starts appearing in the year it was actually kept.
 */
type Since = { from: number }

type On =
  | { kind: 'solar'; month: number; day: number }
  | { kind: 'lunar'; month: number; day: number }
  /** Counted from the first day of Tết, which is the only way to pin new year's eve. */
  | { kind: 'fromTet'; days: number }

const RULES = [
  { key: 'newYear', off: true, on: { kind: 'solar', month: 1, day: 1 } },
  { key: 'tetEve', off: true, on: { kind: 'fromTet', days: -1 } },
  { key: 'tet1', off: true, on: { kind: 'lunar', month: 1, day: 1 } },
  { key: 'tet2', off: true, on: { kind: 'lunar', month: 1, day: 2 } },
  { key: 'tet3', off: true, on: { kind: 'lunar', month: 1, day: 3 } },
  { key: 'hungKings', off: true, on: { kind: 'lunar', month: 3, day: 10 } },
  { key: 'reunification', off: true, on: { kind: 'solar', month: 4, day: 30 } },
  { key: 'labour', off: true, on: { kind: 'solar', month: 5, day: 1 } },
  { key: 'nationalDay', off: true, on: { kind: 'solar', month: 9, day: 2 } },
  // Ngày Văn hóa Việt Nam, voted in on 24 April 2026 and kept from that year.
  { key: 'cultureDay', off: true, from: 2026, on: { kind: 'solar', month: 11, day: 24 } },

  { key: 'kitchenGods', off: false, on: { kind: 'lunar', month: 12, day: 23 } },
  { key: 'lanternFestival', off: false, on: { kind: 'lunar', month: 1, day: 15 } },
  { key: 'womensDay', off: false, on: { kind: 'solar', month: 3, day: 8 } },
  { key: 'doubleFifth', off: false, on: { kind: 'lunar', month: 5, day: 5 } },
  { key: 'martyrsDay', off: false, on: { kind: 'solar', month: 7, day: 27 } },
  { key: 'ghostFestival', off: false, on: { kind: 'lunar', month: 7, day: 15 } },
  { key: 'midAutumn', off: false, on: { kind: 'lunar', month: 8, day: 15 } },
  { key: 'vietnameseWomensDay', off: false, on: { kind: 'solar', month: 10, day: 20 } },
  { key: 'teachersDay', off: false, on: { kind: 'solar', month: 11, day: 20 } },
  { key: 'christmas', off: false, on: { kind: 'solar', month: 12, day: 25 } },
] as const satisfies readonly ({ key: string; off: boolean; on: On } & Partial<Since>)[]

export type HolidayKey = (typeof RULES)[number]['key']

export const HOLIDAY_KEYS = RULES.map((rule) => rule.key)

const iso = (year: number, month: number, day: number): ISODate =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

function dateOf(rule: (typeof RULES)[number], year: number): ISODate | null {
  if (rule.on.kind === 'solar') return iso(year, rule.on.month, rule.on.day)

  if (rule.on.kind === 'fromTet') {
    const tet = fromLunar({ day: 1, month: 1, year })
    return tet ? addDays(tet, rule.on.days) : null
  }

  return fromLunar({ day: rule.on.day, month: rule.on.month, year })
}

export function holidaysIn({ start, end }: DateRange): Holiday[] {
  const firstYear = Number(start.slice(0, 4))
  const lastYear = Number(end.slice(0, 4))

  const out: Holiday[] = []

  /*
   * A year either side, because a lunar date drifts across the new year: the
   * kitchen gods of lunar 2025 fall in solar 2026, and new year's eve of 2027
   * can fall in solar 2026.
   */
  for (let year = firstYear - 1; year <= lastYear + 1; year += 1) {
    for (const rule of RULES) {
      const date = dateOf(rule, year)
      if (!date || date < start || date > end) continue
      if (!('from' in rule) || Number(date.slice(0, 4)) >= rule.from) {
        out.push({ key: rule.key, date, off: rule.off })
      }
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** The holidays on one day — usually none, occasionally two. */
export function holidaysOn(date: ISODate): Holiday[] {
  return holidaysIn({ start: date, end: date })
}
