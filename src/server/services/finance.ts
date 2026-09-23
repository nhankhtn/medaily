import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { Asset, Budget, FinanceCategory, Investment } from '@/lib/db/schema'
import { addMonthsISO, monthEndOf, monthStartOf, today as todayOf, type ISODate } from '@/lib/dates'
import type { AccountType } from '@/lib/finance/account-types'
import { debtBalances, netDebt, type DebtBalance } from '@/lib/finance/debts'
import {
  findAccountBalances,
  findAccounts,
  findAssets,
  findBudgets,
  findCategories,
  findInvestments,
  findTransactionsPage,
  sumByCategory,
  sumDebtsByPerson,
  type AccountBalance,
  type CategoryTotal,
  type TransactionPage,
} from '@/server/repositories/finance'
import type { Payee } from '@/lib/finance/payee'
import { findPeople } from '@/server/repositories/people'
import { dayContextOf, getSettings } from '@/server/services/settings'

export type BudgetView = Budget & { spent: number; categoryName: string }

export type FinanceData = {
  today: ISODate
  monthStart: ISODate
  monthEnd: ISODate
  currency: string
  accounts: {
    id: string
    name: string
    type: AccountType
    currency: string
    openingBalance: string
  }[]
  balances: AccountBalance[]
  categories: FinanceCategory[]
  /** First ledger page for SSR; further pages load via `listTransactions`. */
  transactionsPage: TransactionPage
  byCategory: CategoryTotal[]
  budgets: BudgetView[]
  assets: Asset[]
  investments: (Investment & { marketValue: number | null; unrealized: number | null })[]
  /** Contacts a transaction can be a debt with, or be owed a transfer to. */
  people: Payee[]
  /** Who is still out of balance with you, biggest either way first. */
  debts: DebtBalance[]
  totals: {
    income: number
    expense: number
    net: number
    previousExpense: number
    cash: number
    netWorth: number
    /** Owed to you less what you owe; part of net worth. */
    debt: number
  }
}

export const getFinanceData = cache(async (): Promise<FinanceData> => {
  const settings = await getSettings()
  const userId = await getCurrentUserId()
  const today = todayOf(dayContextOf(settings))
  const monthStart = monthStartOf(today)
  const monthEnd = monthEndOf(today)
  const previousStart = addMonthsISO(monthStart, -1)

  const [
    accountRows,
    balances,
    categories,
    transactionsPage,
    byCategory,
    previousTotals,
    budgetRows,
    assets,
    investments,
    personRows,
    debtRows,
  ] = await Promise.all([
    findAccounts(userId),
    findAccountBalances(userId),
    findCategories(userId),
    findTransactionsPage(userId),
    sumByCategory(userId, { start: monthStart, end: monthEnd }),
    sumByCategory(userId, { start: previousStart, end: monthEndOf(previousStart) }),
    findBudgets(userId, monthStart),
    findAssets(userId),
    findInvestments(userId),
    findPeople(userId, { includeArchived: true }),
    sumDebtsByPerson(userId),
  ])

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

  // Archived people are fetched too: a debt keeps the name it was run up with
  // even after the contact is removed. The picker below stays to the living.
  const debts = debtBalances(
    debtRows,
    (id) => personRows.find((person) => person.id === id)?.name ?? '—',
  )
  const debt = netDebt(debts)

  return {
    today,
    monthStart,
    monthEnd,
    currency: settings.defaultCurrency,
    accounts: accountRows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      currency: row.currency,
      openingBalance: row.openingBalance,
    })),
    balances,
    categories,
    transactionsPage,
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
    people: personRows
      .filter((person) => person.archivedAt === null)
      .map((person) => ({
        id: person.id,
        name: person.name,
        bankBin: person.bankBin,
        bankAccountNumber: person.bankAccountNumber,
        bankAccountName: person.bankAccountName,
        momoPhone: person.momoPhone,
        paymentQr: person.paymentQr,
      })),
    debts,
    totals: {
      income,
      expense,
      net: income - expense,
      previousExpense: sumKind('expense', previousTotals),
      cash,
      // Money lent is still yours — it has moved out of the account but not out
      // of your worth — and money borrowed is not.
      netWorth: cash + assetTotal + investmentTotal + debt,
      debt,
    },
  }
})
