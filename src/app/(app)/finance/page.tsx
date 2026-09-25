import { cookies } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'
import { EmptyState, PageHeader, StatRow, TabNav } from '@/components/ui/page'
import {
  AccountsBoard,
  AssetsBoard,
  BudgetsBoard,
  CategoriesBoard,
  DebtsBoard,
  InvestmentsBoard,
} from '@/features/finance/boards'
import { AccountDialog, CategoryDialog } from '@/features/finance/finance-dialogs'
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
    const report = await getFinanceReport(params.period)

    return (
      <div className="space-y-4">
        <PageHeader title={t('title')} />
        {nav}
        <Report report={report} />
      </div>
    )
  }

  const [locale, data, jar] = await Promise.all([getLocale(), getFinanceData(), cookies()])
  const money = (amount: number) => formatMoney(amount, data.currency, locale)

  const header = (
    <PageHeader
      title={t('title')}
      action={
        <div className="flex flex-wrap gap-2">
          <AccountDialog defaultCurrency={data.currency} />
          <CategoryDialog />
        </div>
      }
    />
  )

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
    return (
      <div className="space-y-4">
        {header}
        {nav}
        <div className="lg:max-w-xl">
          <BudgetsBoard data={data} />
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
