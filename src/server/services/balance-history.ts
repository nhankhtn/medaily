import { cache } from 'react'
import { rangeOfLastDays, today as todayOf } from '@/lib/dates'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { DailyBalancePoint } from '@/server/repositories/finance'
import { findAccounts, findDailyBalances } from '@/server/repositories/finance'
import { dayContextOf, getSettings } from '@/server/services/settings'

/**
 * How far back the chart can look. One fetch covers every range it offers, so
 * a longer memory here is a bigger payload every time the page is opened.
 */
const HISTORY_DAYS = 180

export type BalanceHistory = {
  points: DailyBalancePoint[]
  accounts: { id: string; name: string }[]
  currency: string
}

/**
 * The closing balance per account per day, and nothing else.
 *
 * Its own read because the chart moved to the report tab, which deliberately
 * loads none of the ledger: the whole point of that branch returning early is
 * that opening a report does not pay for transactions, budgets, holdings and
 * debts nobody asked to see. Two queries are a fair price for a chart; the
 * finance page's dozen are not.
 */
export const getBalanceHistory = cache(async (): Promise<BalanceHistory> => {
  const settings = await getSettings()
  const userId = await getCurrentUserId()
  const today = todayOf(dayContextOf(settings))

  const [points, accounts] = await Promise.all([
    findDailyBalances(userId, rangeOfLastDays(today, HISTORY_DAYS)),
    findAccounts(userId),
  ])

  return {
    points,
    accounts: accounts.map((account) => ({ id: account.id, name: account.name })),
    currency: settings.defaultCurrency,
  }
})
