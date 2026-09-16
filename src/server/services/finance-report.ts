import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { monthStartOf, today as todayOf, yearOf, type ISODate } from '@/lib/dates'
import {
  averageOf,
  monthlyTotals,
  parsePeriod,
  periodMonths,
  periodRange,
  previousPeriod,
  savingsRate,
  spendShares,
  type CategorySlice,
  type CategorySpend,
  type MonthTotals,
  type Period,
} from '@/lib/finance/report'
import {
  findCategories,
  findEarliestTransactionDate,
  findLargestExpenses,
  sumByCategory,
  sumByMonth,
} from '@/server/repositories/finance'
import { dayContextOf, getSettings } from '@/server/services/settings'

export type LargestExpense = {
  id: string
  occurredOn: ISODate
  amount: number
  label: string
  categoryName: string | null
}

export type FinanceReport = {
  period: Period
  /** Every year worth offering in the picker, newest first. */
  years: number[]
  currency: string
  months: MonthTotals[]
  spend: CategorySlice[]
  largest: LargestExpense[]
  totals: {
    income: number
    expense: number
    net: number
    /** Percent of income kept, or null when nothing came in. */
    savingsRate: number | null
    /** Mean spending of the other months in view, or null when there are none. */
    averageExpense: number | null
    /** The same stretch before this one, for the period to be measured against. */
    previousExpense: number
  }
  /** Whether the chosen period holds anything at all. */
  hasData: boolean
}

/**
 * `raw` is the `period` search param, straight off the URL. Resolving it here
 * rather than in the page keeps one answer to what today is, and hands the
 * resolved period back for the picker to show.
 */
export const getFinanceReport = cache(async (raw: string | undefined): Promise<FinanceReport> => {
  const settings = await getSettings()
  const userId = await getCurrentUserId()
  const today = todayOf(dayContextOf(settings))
  const period = parsePeriod(raw, today)
  const range = periodRange(period)
  const previous = periodRange(previousPeriod(period))
  const months = periodMonths(period)
  const chartRange = { start: months[0] ?? range.start, end: range.end }

  const [monthRows, categories, thisPeriod, lastPeriod, largestRows, earliest] = await Promise.all([
    sumByMonth(userId, chartRange),
    findCategories(userId),
    sumByCategory(userId, range),
    sumByCategory(userId, previous),
    findLargestExpenses(userId, range),
    findEarliestTransactionDate(userId),
  ])

  const totals = monthlyTotals(months, monthRows)
  const sumKind = (rows: typeof thisPeriod, kind: string) =>
    rows.filter((row) => row.kind === kind).reduce((total, row) => total + row.total, 0)

  const income = sumKind(thisPeriod, 'income')
  const expense = sumKind(thisPeriod, 'expense')

  const nameOf = (id: string | null) =>
    id === null ? null : (categories.find((row) => row.id === id)?.name ?? null)

  // Every expense category that saw money in this period or the one before, so
  // a line that went to zero still shows up — that it stopped is the point.
  const spentIn = (rows: typeof thisPeriod, id: string | null) =>
    rows.find((row) => row.categoryId === id && row.kind === 'expense')?.total ?? 0

  const spendIds = [
    ...new Set(
      [...thisPeriod, ...lastPeriod]
        .filter((row) => row.kind === 'expense')
        .map((row) => row.categoryId),
    ),
  ]

  const spend: CategorySpend[] = spendIds.map((id) => ({
    id,
    name: nameOf(id) ?? '—',
    total: spentIn(thisPeriod, id),
    previous: spentIn(lastPeriod, id),
  }))

  // A year has no single month to hold up against an average, and the chosen
  // month must not be averaged into its own yardstick.
  const chosenMonth = period.month === null ? null : range.start
  const firstYear = earliest === null ? yearOf(today) : yearOf(earliest)
  const thisYear = yearOf(today)

  return {
    period,
    years: Array.from(
      { length: Math.max(1, thisYear - Math.min(firstYear, period.year) + 1) },
      (_, index) => thisYear - index,
    ),
    currency: settings.defaultCurrency,
    months: totals,
    spend: spendShares(spend),
    largest: largestRows.map((row) => ({
      id: row.id,
      occurredOn: row.occurredOn,
      amount: Number(row.amount),
      label: row.merchant ?? row.note ?? '',
      categoryName: nameOf(row.categoryId),
    })),
    totals: {
      income,
      expense,
      net: income - expense,
      savingsRate: savingsRate(income, expense),
      averageExpense:
        chosenMonth === null
          ? null
          : averageOf(totals, (month) => month.expense, [chosenMonth, monthStartOf(today)]),
      previousExpense: sumKind(lastPeriod, 'expense'),
    },
    hasData: income > 0 || expense > 0 || largestRows.length > 0,
  }
})
