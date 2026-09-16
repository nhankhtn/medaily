import { addMonthsISO, monthEndOf, monthStartOf, type DateRange, type ISODate } from '@/lib/dates'

/**
 * The arithmetic behind the finance report, kept pure so it can be tested
 * without a database: everything here takes rows and gives numbers.
 */

/** A month of a year, or a whole year when `month` is null. */
export type Period = { year: number; month: number | null }

const pad = (value: number) => String(value).padStart(2, '0')

/** What goes in the URL: `2026-09` for a month, `2026` for the year. */
export function formatPeriod({ year, month }: Period): string {
  return month === null ? String(year) : `${year}-${pad(month)}`
}

/**
 * Reads a period off the URL, falling back to the month `today` is in. A
 * address someone typed by hand is not to be trusted, so anything that is not
 * a year or a year and a real month falls back rather than throwing.
 */
export function parsePeriod(raw: string | undefined, today: ISODate): Period {
  const fallback: Period = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
  if (raw === undefined) return fallback

  const year = /^(\d{4})$/.exec(raw)
  if (year) return { year: Number(year[1]), month: null }

  const month = /^(\d{4})-(\d{2})$/.exec(raw)
  if (!month) return fallback

  const value = Number(month[2])
  if (value < 1 || value > 12) return fallback
  return { year: Number(month[1]), month: value }
}

export function periodRange({ year, month }: Period): DateRange {
  if (month === null) return { start: `${year}-01-01`, end: `${year}-12-31` }
  const start = `${year}-${pad(month)}-01`
  return { start, end: monthEndOf(start) }
}

/** The stretch before it, of the same length: last month, or last year. */
export function previousPeriod({ year, month }: Period): Period {
  if (month === null) return { year: year - 1, month: null }
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

/** The first days of the `count` months ending with the one `end` falls in, oldest first. */
export function monthsBack(end: ISODate, count: number): ISODate[] {
  const last = monthStartOf(end)
  return Array.from({ length: count }, (_, index) => addMonthsISO(last, index - (count - 1)))
}

/**
 * The months the trend chart draws: a year in full, or the half-year ending at
 * the chosen month, so a month is always shown with the run-up to it.
 */
export function periodMonths(period: Period): ISODate[] {
  if (period.month === null) {
    return Array.from({ length: 12 }, (_, index) => `${period.year}-${pad(index + 1)}-01`)
  }
  return monthsBack(periodRange(period).start, 6)
}

export type MonthKindTotal = { month: ISODate; kind: string; total: number }

export type MonthTotals = { month: ISODate; income: number; expense: number; net: number }

/**
 * Income and spending per month, with months that hold nothing kept as zeroes.
 * A month you recorded nothing in is still a month, and dropping it would slide
 * the remaining bars along the axis and date every one of them wrong.
 *
 * Transfers are ignored: money moved between your own accounts is neither.
 */
export function monthlyTotals(months: ISODate[], rows: MonthKindTotal[]): MonthTotals[] {
  return months.map((month) => {
    const sum = (kind: string) =>
      rows
        .filter((row) => row.month === month && row.kind === kind)
        .reduce((total, row) => total + row.total, 0)

    const income = sum('income')
    const expense = sum('expense')
    return { month, income, expense, net: income - expense }
  })
}

/**
 * How much of what came in stayed, as a percentage. Null when nothing came in:
 * with no income there is no rate to give, and 0% would read as breaking even.
 * Negative is meaningful — it says the period ate into what was already there.
 */
export function savingsRate(income: number, expense: number): number | null {
  if (income <= 0) return null
  return ((income - expense) / income) * 100
}

/**
 * What a normal month costs, for the chosen one to be measured against.
 *
 * `exclude` is for the months that would poison the answer: the chosen month
 * itself, which cannot be its own yardstick, and the month now running, which
 * is not over and would read as a cheap one. Months with nothing recorded are
 * dropped too — a month from before you started is not a month you spent
 * nothing in.
 */
export function averageOf(
  months: MonthTotals[],
  pick: (month: MonthTotals) => number,
  exclude: ISODate[] = [],
): number | null {
  const settled = months.filter(
    (month) => !exclude.includes(month.month) && (month.income > 0 || month.expense > 0),
  )
  if (settled.length === 0) return null
  return settled.reduce((total, month) => total + pick(month), 0) / settled.length
}

export type CategorySpend = { id: string | null; name: string; total: number; previous: number }

/**
 * `rest` marks the one slice that is several categories added together, which
 * is not the same thing as the slice for spending that has no category at all
 * — both would otherwise be an id of null, and they read very differently.
 */
export type CategorySlice = CategorySpend & { share: number; rest?: boolean }

/** Biggest first, each with its share of the period's spending. */
export function spendShares(rows: CategorySpend[]): CategorySlice[] {
  const spent = rows.reduce((total, row) => total + row.total, 0)

  return [...rows]
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((row) => ({ ...row, share: spent > 0 ? (row.total / spent) * 100 : 0 }))
}

/**
 * Keeps the biggest `limit` and folds the tail into one slice.
 *
 * A pie with twenty slivers answers nothing, and the question this chart is
 * for — which category takes the most — is answered by the few at the top. The
 * folded slice carries the id `null` under the caller's chosen name, and its
 * `previous` is summed too so the change still adds up.
 */
export function foldSlices(rows: CategorySlice[], name: string, limit = 7): CategorySlice[] {
  if (rows.length <= limit + 1) return rows

  const kept = rows.slice(0, limit)
  const rest = rows.slice(limit)
  const sum = (pick: (row: CategorySlice) => number) =>
    rest.reduce((total, row) => total + pick(row), 0)

  return [
    ...kept,
    {
      id: null,
      rest: true,
      name,
      total: sum((row) => row.total),
      previous: sum((row) => row.previous),
      share: sum((row) => row.share),
    },
  ]
}
