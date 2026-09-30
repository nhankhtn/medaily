import { cache } from 'react'
import { addMonthsISO, monthEndOf, monthStartOf, today as todayOf, type ISODate } from '@/lib/dates'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { findBudgets, findCategories, sumByCategory } from '@/server/repositories/finance'
import { dayContextOf, getSettings } from '@/server/services/settings'
import type { BudgetView } from './finance'

/**
 * A month of budgets, and how the spending went against them.
 *
 * Its own read rather than a slice of `getFinanceData`, which always asks
 * about the month running now. A budget is only interesting beside what was
 * actually spent in the same stretch, so looking back at September means
 * fetching both for September — the ledger, the balances and the holdings
 * that page also loads have nothing to do with it.
 */
export type BudgetMonth = {
  /** The month being shown, and today's, so a caller can tell them apart. */
  periodStart: ISODate
  currentStart: ISODate
  currency: string
  budgets: BudgetView[]
  totals: { budgeted: number; spent: number }
  /**
   * The month to copy from, when this one has nothing and an earlier one
   * does. Null where there is nothing to offer — including on a past month,
   * where filling in a budget after the fact would describe a plan nobody
   * made.
   */
  copyFrom: ISODate | null
}

export const getBudgetMonth = cache(async (period?: string): Promise<BudgetMonth> => {
  const settings = await getSettings()
  const userId = await getCurrentUserId()

  const currentStart = monthStartOf(todayOf(dayContextOf(settings)))
  const periodStart = monthStartOf(asMonth(period) ?? currentStart)
  const previousStart = addMonthsISO(periodStart, -1)

  const [rows, categories, spend] = await Promise.all([
    findBudgets(userId, periodStart),
    findCategories(userId),
    sumByCategory(userId, { start: periodStart, end: monthEndOf(periodStart) }),
  ])

  const nameOf = (id: string) => categories.find((category) => category.id === id)?.name ?? ''
  const budgets: BudgetView[] = rows
    .map((budget) => ({
      ...budget,
      categoryName: nameOf(budget.categoryId),
      spent:
        spend.find((row) => row.categoryId === budget.categoryId && row.kind === 'expense')
          ?.total ?? 0,
    }))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName))

  return {
    periodStart,
    currentStart,
    currency: settings.defaultCurrency,
    budgets,
    totals: {
      budgeted: budgets.reduce((sum, budget) => sum + Number(budget.amount), 0),
      spent: budgets.reduce((sum, budget) => sum + budget.spent, 0),
    },
    copyFrom:
      periodStart === currentStart &&
      budgets.length === 0 &&
      (await hasBudgets(userId, previousStart))
        ? previousStart
        : null,
  }
})

async function hasBudgets(userId: string, periodStart: ISODate): Promise<boolean> {
  return (await findBudgets(userId, periodStart)).length > 0
}

/**
 * `2026-09` or `2026-09-01` from the address, or nothing.
 *
 * Read rather than trusted: this arrives in a URL, so a month that does not
 * exist has to fall back to the one running now instead of reaching the date
 * helpers as a string they will happily do arithmetic on.
 */
export function asMonth(period: string | null | undefined): ISODate | null {
  if (!period) return null
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(period.trim())
  if (!match) return null
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return `${match[1]}-${match[2]}-01` as ISODate
}
