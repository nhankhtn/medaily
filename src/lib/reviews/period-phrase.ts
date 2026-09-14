import { addDays, addMonthsISO, monthStartOf, weekStartOf, type ISODate } from '@/lib/dates'
import { foldText } from '@/lib/text'

/**
 * Which period a person meant by "tuần này" or "last month".
 *
 * Resolved here rather than by the model: a date range is arithmetic, and
 * getting it from a language model would cost a round trip to be less reliable
 * than a regex. The model is left to do the part only it can do.
 */
export type ReviewPeriodRef = { period: 'weekly' | 'monthly'; key: ISODate }

/*
 * Matched against accent-folded text, so every way of typing "tuần" lands on
 * the same branch. Longest first: "tuan truoc nua" must not be eaten by
 * "tuan truoc".
 */
const WEEK_OFFSETS: [RegExp, number][] = [
  [/tuan truoc nua|tuan kia|two weeks ago/, -2],
  [/tuan (truoc|roi|qua)|last week/, -1],
  [/tuan (nay|hien tai)|this week/, 0],
]

const MONTH_OFFSETS: [RegExp, number][] = [
  [/thang truoc nua|two months ago/, -2],
  [/thang (truoc|roi|qua)|last month/, -1],
  [/thang (nay|hien tai)|this month/, 0],
]

/** "tháng 9", "tháng 09", "month 9" — a month by number, in the last year. */
const NUMBERED_MONTH = /thang\s*(\d{1,2})(?!\d)|(?:^|\s)month\s*(\d{1,2})(?!\d)/

function monthByNumber(folded: string, today: ISODate): ISODate | null {
  const match = NUMBERED_MONTH.exec(folded)
  const month = Number(match?.[1] ?? match?.[2] ?? NaN)
  if (!Number.isInteger(month) || month < 1 || month > 12) return null

  const thisYear = `${today.slice(0, 4)}-${String(month).padStart(2, '0')}-01`
  // A month later than today is last year's: in January, "tháng 12" is behind.
  return thisYear <= today ? thisYear : addMonthsISO(thisYear, -12)
}

/**
 * Defaults to the current week — the period someone is most likely reviewing,
 * and the one the reply names out loud anyway, so a wrong guess is visible and
 * one message away from being corrected.
 */
export function parsePeriodPhrase(
  text: string,
  today: ISODate,
  weekStart: 'monday' | 'sunday',
): ReviewPeriodRef {
  const folded = foldText(text)

  for (const [pattern, offset] of MONTH_OFFSETS) {
    if (pattern.test(folded)) {
      return { period: 'monthly', key: addMonthsISO(monthStartOf(today), offset) }
    }
  }

  const numbered = monthByNumber(folded, today)
  if (numbered) return { period: 'monthly', key: numbered }

  for (const [pattern, offset] of WEEK_OFFSETS) {
    if (pattern.test(folded)) {
      return { period: 'weekly', key: addDays(weekStartOf(today, weekStart), offset * 7) }
    }
  }

  if (/thang|month/.test(folded)) return { period: 'monthly', key: monthStartOf(today) }
  return { period: 'weekly', key: weekStartOf(today, weekStart) }
}
