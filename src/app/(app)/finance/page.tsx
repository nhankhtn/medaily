import { cookies } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'
import { EmptyState, PageHeader, StatRow, TabNav } from '@/components/ui/page'
import { BalanceHistory } from '@/features/finance/balance-history'
import {
  AccountsBoard,
  AssetsBoard,
  CategoriesBoard,
  DebtsBoard,
  InvestmentsBoard,
} from '@/features/finance/boards'
import { BudgetPanel } from '@/features/finance/budget-panel'
import { AccountDialog } from '@/features/finance/finance-dialogs'
import { getBalanceHistory } from '@/server/services/balance-history'
import { getBudgetMonth } from '@/server/services/budgets'
import { LedgerView } from '@/features/finance/ledger-view'
import { Report } from '@/features/finance/report'
import { formatMoney } from '@/lib/format/money'
import { PATHS, type FinanceTab } from '@/lib/paths'
import { isDesktopCookie, VIEWPORT_COOKIE } from '@/lib/viewport'
import { getFinanceData } from '@/server/services/finance'
import { getFinanceReport } from '@/server/services/finance-report'

const TABS = ['overview', 'accounts', 'budgets', 'report'] satisfies FinanceTab[]

function tabFrom(value: string | undefined): FinanceTab {
  return (TABS as readonly string[]).includes(value ?? '') ? (value as FinanceTab) : 'overview'
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; period?: string }>
}) {
  const [params, t] = await Promise.all([searchParams, getTranslations('finance')])
  const tab = tabFrom(params.tab)

  const tabs = TABS.map((key) => ({ key, label: t(`tabs.${key}`), href: PATHS.financeTab(key) }))
  const nav = <TabNav tabs={tabs} current={tab} />

  // Each tab reads only what it shows, so opening the report does not pay for
  // a ledger page nobody asked for.
  if (tab === 'report') {
    // Two focused reads rather than the whole ledger: the chart needs the
    // daily balances and the account names, and nothing else on this page.
    const [report, history] = await Promise.all([
      getFinanceReport(params.period),
      getBalanceHistory(),
    ])

    return (
      <div className="space-y-4">
        <PageHeader title={t('title')} />
        {nav}
        <BalanceHistory
          points={history.points}
          accounts={history.accounts}
          currency={history.currency}
        />
        <Report report={report} />
      </div>
    )
  }

  const [locale, data, jar] = await Promise.all([getLocale(), getFinanceData(), cookies()])
  const money = (amount: number) => formatMoney(amount, data.currency, locale)

  /*
   * No action on the title. Adding an account and adding a category now sit on
   * the cards that list them, over on the Accounts tab — next to the thing
   * they make, rather than on every tab whether or not it has anything to do
   * with either. The Categories card and the Budgets card already carried
   * their own, so the header pair was a second copy on the one tab where both
   * were already reachable.
   */
  const header = <PageHeader title={t('title')} />

  if (tab === 'accounts') {
    return (
      <div className="space-y-4">
        {header}
        {nav}
        <div className="grid gap-4 lg:grid-cols-2">
          <DebtsBoard data={data} />
          <AccountsBoard data={data} />
          <CategoriesBoard data={data} />
          <AssetsBoard data={data} />
          <InvestmentsBoard data={data} />
        </div>
      </div>
    )
  }

  if (tab === 'budgets') {
    // Its own read: the budget tab is the one that can look at a month other
    // than this one, and the ledger above was loaded for this one.
    const month = await getBudgetMonth(params.period)

    return (
      <div className="space-y-4">
        {header}
        {nav}
        <div className="lg:max-w-xl">
          <BudgetPanel month={month} categories={data.categories} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {header}
      {nav}
      <StatRow
        items={[
          { label: t('netWorth'), value: money(data.totals.netWorth) },
          { label: t('cash'), value: money(data.totals.cash) },
          { label: t('income'), value: money(data.totals.income), hint: t('thisMonth') },
          {
            label: t('expense'),
            value: money(data.totals.expense),
            hint:
              data.totals.previousExpense > 0
                ? `${money(data.totals.expense - data.totals.previousExpense)} ${t('vsLastMonth')}`
                : t('thisMonth'),
          },
        ]}
      />
      {data.accounts.length === 0 ? (
        <EmptyState
          title={t('noAccounts')}
          body={t('noAccountsBody')}
          action={<AccountDialog defaultCurrency={data.currency} />}
        />
      ) : (
        // What the last visit measured; a first visit may correct itself once.
        <LedgerView data={data} initialDesktop={isDesktopCookie(jar.get(VIEWPORT_COOKIE)?.value)} />
      )}
    </div>
  )
}
