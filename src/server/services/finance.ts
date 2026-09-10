import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { Asset, Budget, FinanceCategory, Investment, Transaction } from '@/lib/db/schema'
import {
  addMonthsISO,
  monthEndOf,
  monthStartOf,
  today as todayOf,
  type ISODate,
} from '@/lib/dates'
import {
  findAccountBalances,
  findAccounts,
  findAssets,
  findBudgets,
  findCategories,
  findInvestments,
  findTransactions,
  sumByCategory,
  type AccountBalance,
  type CategoryTotal,
} from '@/server/repositories/finance'
import { dayContextOf, getSettings } from '@/server/services/settings'

export type BudgetView = Budget & { spent: number; categoryName: string }

export type FinanceData = {
  today: ISODate
  monthStart: ISODate
  monthEnd: ISODate
  currency: string
  accounts: { id: string; name: string; currency: string }[]
  balances: AccountBalance[]
  categories: FinanceCategory[]
  transactions: Transaction[]
  byCategory: CategoryTotal[]
  budgets: BudgetView[]
  assets: Asset[]
  investments: (Investment & { marketValue: number | null; unrealized: number | null })[]
  totals: {
    income: number
    expense: number
    net: number
    previousExpense: number
    cash: number
    netWorth: number
  }
}

export const getFinanceData = cache(async (): Promise<FinanceData> => {
  const settings = await getSettings()
  const userId = await getCurrentUserId()
  const today = todayOf(dayContextOf(settings))
  const monthStart = monthStartOf(today)
  const monthEnd = monthEndOf(today)
  const previousStart = addMonthsISO(monthStart, -1)

  const [accountRows, balances, categories, transactions, byCategory, previousTotals, budgetRows, assets, investments] =
    await Promise.all([
      findAccounts(userId),
      findAccountBalances(userId),
      findCategories(userId),
      findTransactions(userId, { start: previousStart, end: monthEnd }),
      sumByCategory(userId, { start: monthStart, end: monthEnd }),
      sumByCategory(userId, { start: previousStart, end: monthEndOf(previousStart) }),
      findBudgets(userId, monthStart),
      findAssets(userId),
      findInvestments(userId),
    ])

  const monthTransactions = transactions.filter((row) => row.occurredOn >= monthStart)
  const sumKind = (kind: string, rows: CategoryTotal[]) =>
    rows.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.total, 0)

  const income = sumKind('income', byCategory)
  const expense = sumKind('expense', byCategory)
  const cash = balances.reduce((sum, account) => sum + account.balance, 0)

  const investmentViews = investments.map((investment) => {
    const price = investment.lastPrice === null ? null : Number(investment.lastPrice)
    const quantity = Number(investment.quantity)
    const cost = Number(investment.avgCost) * quantity
    const marketValue = price === null ? null : price * quantity
    return {
      ...investment,
      marketValue,
      unrealized: marketValue === null ? null : marketValue - cost,
    }
  })

  const assetTotal = assets.reduce(
    (sum, asset) => sum + (asset.kind === 'liability' ? -1 : 1) * Number(asset.value),
    0,
  )
  const investmentTotal = investmentViews.reduce((sum, row) => sum + (row.marketValue ?? 0), 0)

  const categoryName = (id: string) => categories.find((row) => row.id === id)?.name ?? '—'

  return {
    today,
    monthStart,
    monthEnd,
    currency: settings.defaultCurrency,
    accounts: accountRows.map((row) => ({ id: row.id, name: row.name, currency: row.currency })),
    balances,
    categories,
    transactions: monthTransactions,
    byCategory,
    budgets: budgetRows.map((budget) => ({
      ...budget,
      categoryName: categoryName(budget.categoryId),
      spent:
        byCategory.find((row) => row.categoryId === budget.categoryId && row.kind === 'expense')
          ?.total ?? 0,
    })),
    assets,
    investments: investmentViews,
    totals: {
      income,
      expense,
      net: income - expense,
      previousExpense: sumKind('expense', previousTotals),
      cash,
      netWorth: cash + assetTotal + investmentTotal,
    },
  }
})
