'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatMoney } from '@/lib/format/money'
import type { FinanceData } from '@/server/services/finance'
import { AccountIcon } from './account-icon'
import { CategoryList } from './category-list'
import {
  AccountEditDialog,
  AssetDialog,
  BudgetDialog,
  BudgetEditDialog,
  CategoryDialog,
  InvestmentDialog,
} from './finance-dialogs'

/**
 * The standing boards of the finance page — what you hold, what you owe, what
 * you budgeted. Shared by both layouts: phone and desktop disagree about the
 * order and the grouping, never about what a board says.
 */
type BoardProps = { data: FinanceData }

function useMoney(currency: string) {
  const locale = useLocale()
  return (amount: number) => formatMoney(amount, currency, locale)
}

export function DebtsBoard({ data }: BoardProps) {
  const t = useTranslations('finance')
  const money = useMoney(data.currency)
  if (data.debts.length === 0) return null

  return (
    <Card className="min-w-0">
      <CardHeader title={t('debts')} />
      <CardBody>
        <ul className="divide-border-base divide-y">
          {data.debts.map((row) => (
            <li key={row.personId} className="flex items-baseline gap-2 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
              <span className="text-text-subtle shrink-0 text-xs">
                {row.outstanding > 0 ? t('owesYou') : t('youOwe')}
              </span>
              <span
                className={
                  row.outstanding > 0
                    ? 'text-good shrink-0 text-sm font-medium tabular-nums'
                    : 'text-bad shrink-0 text-sm font-medium tabular-nums'
                }
              >
                {money(Math.abs(row.outstanding))}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-text-subtle mt-3 text-xs leading-snug">{t('debtHint')}</p>
      </CardBody>
    </Card>
  )
}

export function AccountsBoard({ data }: BoardProps) {
  const t = useTranslations('finance')
  const locale = useLocale()
  if (data.accounts.length === 0) return null

  return (
    <Card>
      <CardHeader title={t('accounts')} />
      <CardBody>
        <ul className="divide-border-base divide-y">
          {data.balances.map((balance) => {
            const account = data.accounts.find((row) => row.id === balance.accountId)
            return (
              <li key={balance.accountId} className="flex items-center gap-3 py-2">
                <AccountIcon type={balance.type} />
                {account ? (
                  <AccountEditDialog account={account} />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm">{balance.name}</span>
                )}
                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatMoney(balance.balance, balance.currency, locale)}
                </span>
              </li>
            )
          })}
        </ul>
      </CardBody>
    </Card>
  )
}

export function CategoriesBoard({ data }: BoardProps) {
  const t = useTranslations('finance')

  return (
    <Card>
      <CardHeader title={t('categories')} action={<CategoryDialog />} />
      <CardBody>
        {data.categories.length === 0 ? (
          <p className="text-text-subtle text-sm">{t('noCategories')}</p>
        ) : (
          <CategoryList categories={data.categories} />
        )}
      </CardBody>
    </Card>
  )
}

export function BudgetsBoard({ data }: BoardProps) {
  const t = useTranslations('finance')
  const money = useMoney(data.currency)
  const hasExpenseCategory = data.categories.some((category) => category.kind === 'expense')

  return (
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
                    <BudgetEditDialog budget={budget} />
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
  )
}

export function AssetsBoard({ data }: BoardProps) {
  const t = useTranslations('finance')
  const money = useMoney(data.currency)

  return (
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
                <span className="shrink-0 text-sm tabular-nums">{money(Number(asset.value))}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

export function InvestmentsBoard({ data }: BoardProps) {
  const t = useTranslations('finance')
  const money = useMoney(data.currency)

  return (
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
  )
}
