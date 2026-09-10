import { getLocale, getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { EmptyState, PageHeader, StatRow } from '@/components/ui/page'
import { Progress } from '@/components/ui/progress'
import {
  AccountDialog,
  AssetDialog,
  BudgetDialog,
  CategoryDialog,
  InvestmentDialog,
} from '@/features/finance/finance-dialogs'
import { TransactionForm } from '@/features/finance/transaction-form'
import { TransactionList } from '@/features/finance/transaction-list'
import { formatMoney } from '@/lib/format/money'
import { getFinanceData } from '@/server/services/finance'

export default async function FinancePage() {
  const [t, locale, data] = await Promise.all([
    getTranslations('finance'),
    getLocale(),
    getFinanceData(),
  ])

  const money = (amount: number) => formatMoney(amount, data.currency, locale)
  const hasExpenseCategory = data.categories.some((category) => category.kind === 'expense')

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('title')}
        action={
          <div className="flex flex-wrap gap-2">
            <AccountDialog defaultCurrency={data.currency} />
            <CategoryDialog />
          </div>
        }
      />

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
        <Card>
          <CardHeader title={t('transactions')} />
          <CardBody className="space-y-4">
            <TransactionForm
              accounts={data.accounts}
              categories={data.categories}
              today={data.today}
            />
            <TransactionList
              transactions={data.transactions}
              categories={data.categories}
              accounts={data.accounts}
              currency={data.currency}
            />
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {data.accounts.length > 0 ? (
          <Card>
            <CardHeader title={t('accounts')} />
            <CardBody>
              <ul className="divide-border-base divide-y">
                {data.balances.map((account) => (
                  <li key={account.accountId} className="flex items-center justify-between py-2">
                    <span className="truncate text-sm">{account.name}</span>
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {formatMoney(account.balance, account.currency, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title={t('categories')} action={<CategoryDialog />} />
          <CardBody>
            {data.categories.length === 0 ? (
              <p className="text-text-subtle text-sm">{t('noCategories')}</p>
            ) : (
              <ul className="divide-border-base divide-y">
                {data.categories.map((category) => (
                  <li key={category.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0 truncate text-sm">{category.name}</span>
                    <Badge tone={category.kind === 'income' ? 'good' : 'neutral'}>
                      {t(`kinds.${category.kind}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('budgets')}
            action={
              hasExpenseCategory ? (
                <BudgetDialog categories={data.categories} monthStart={data.monthStart} />
              ) : (
                <CategoryDialog />
              )
            }
          />
          <CardBody>
            {!hasExpenseCategory ? (
              <p className="text-text-subtle text-sm leading-snug">{t('needCategoryFirst')}</p>
            ) : data.budgets.length === 0 ? (
              <p className="text-text-subtle text-sm">{t('noBudgets')}</p>
            ) : (
              <ul className="space-y-3">
                {data.budgets.map((budget) => {
                  const amount = Number(budget.amount)
                  const share = amount > 0 ? (budget.spent / amount) * 100 : 0
                  const over = budget.spent > amount

                  return (
                    <li key={budget.id} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm">{budget.categoryName}</span>
                        <span className="text-text-muted shrink-0 text-xs tabular-nums">
                          {t('budgetOf', { spent: money(budget.spent), amount: money(amount) })}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, share)}
                        tone={over ? 'bad' : share > 90 ? 'warn' : 'accent'}
                        label={budget.categoryName}
                      />
                      <p className={over ? 'text-bad text-xs' : 'text-text-subtle text-xs'}>
                        {over
                          ? t('overBudget', { amount: money(budget.spent - amount) })
                          : t('remaining', { amount: money(amount - budget.spent) })}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('assets')} action={<AssetDialog today={data.today} />} />
          <CardBody>
            {data.assets.length === 0 ? (
              <p className="text-text-subtle text-sm">—</p>
            ) : (
              <ul className="divide-border-base divide-y">
                {data.assets.map((asset) => (
                  <li key={asset.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0 truncate text-sm">{asset.name}</span>
                    <Badge tone={asset.kind === 'liability' ? 'bad' : 'good'}>
                      {t(asset.kind === 'liability' ? 'liability' : 'asset')}
                    </Badge>
                    <span className="shrink-0 text-sm tabular-nums">
                      {money(Number(asset.value))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('investments')} action={<InvestmentDialog today={data.today} />} />
          <CardBody>
            {data.investments.length === 0 ? (
              <p className="text-text-subtle text-sm">—</p>
            ) : (
              <ul className="divide-border-base divide-y">
                {data.investments.map((investment) => (
                  <li key={investment.id} className="flex items-center gap-2 py-2">
                    <span className="w-16 shrink-0 font-medium">{investment.symbol}</span>
                    <span className="text-text-subtle min-w-0 flex-1 truncate text-xs tabular-nums">
                      {Number(investment.quantity)} × {money(Number(investment.avgCost))}
                    </span>
                    {investment.marketValue === null ? (
                      <span className="text-text-subtle shrink-0 text-xs">{t('noPrice')}</span>
                    ) : (
                      <>
                        <span className="shrink-0 text-sm tabular-nums">
                          {money(investment.marketValue)}
                        </span>
                        <span
                          className={
                            (investment.unrealized ?? 0) >= 0
                              ? 'text-good shrink-0 text-xs tabular-nums'
                              : 'text-bad shrink-0 text-xs tabular-nums'
                          }
                        >
                          {(investment.unrealized ?? 0) >= 0 ? '+' : ''}
                          {money(investment.unrealized ?? 0)}
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
