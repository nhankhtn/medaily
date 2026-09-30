'use client'

import { ChevronLeft, ChevronRight, CopyPlus } from 'lucide-react'
import Link from 'next/link'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { addMonthsISO, fromISODate, type ISODate } from '@/lib/dates'
import { formatMoney } from '@/lib/format/money'
import { PATHS } from '@/lib/paths'
import { copyLastMonthBudgets } from '@/server/actions/finance'
import type { BudgetMonth } from '@/server/services/budgets'
import { BudgetDialog, BudgetEditDialog } from './finance-dialogs'
import type { FinanceData } from '@/server/services/finance'

/** `2026-09-01` as the address wants it. */
const monthParam = (date: ISODate) => date.slice(0, 7)

export function BudgetPanel({
  month,
  categories,
}: {
  month: BudgetMonth
  categories: FinanceData['categories']
}) {
  const t = useTranslations('finance')
  const tc = useTranslations('common')
  const format = useFormatter()
  const locale = useLocale()
  const [pending, startTransition] = useTransition()

  const money = (value: number) => formatMoney(value, month.currency, locale)
  const { budgeted, spent } = month.totals
  const over = spent > budgeted
  /** Only the forward arrow depends on this; a month is editable either way. */
  const past = month.periodStart < month.currentStart

  return (
    <Card>
      <CardHeader
        title={t('budgets')}
        action={<BudgetDialog categories={categories} monthStart={month.periodStart} />}
      />
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" asChild aria-label={t('previousMonth')}>
            <Link
              href={PATHS.financeTab('budgets', monthParam(addMonthsISO(month.periodStart, -1)))}
            >
              <ChevronLeft className="size-4" />
            </Link>
          </Button>

          <span className="text-sm font-medium">
            {format.dateTime(fromISODate(month.periodStart), 'monthYear')}
          </span>

          {/* No door into a month that has not happened: there is nothing
              spent to compare a budget against yet. */}
          {past ? (
            <Button variant="ghost" size="icon" asChild aria-label={t('nextMonth')}>
              <Link
                href={PATHS.financeTab('budgets', monthParam(addMonthsISO(month.periodStart, 1)))}
              >
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <span className="size-9" />
          )}
        </div>

        {month.budgets.length === 0 ? (
          <div className="space-y-3">
            <p className="text-text-subtle text-sm">{t('noBudgets')}</p>
            {month.copyFrom ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await copyLastMonthBudgets()
                    if (!result.ok) toast.error(tc('error'))
                    else toast.success(t('copiedBudgets', { count: result.created }))
                  })
                }
              >
                <CopyPlus className="size-4" />
                {t('copyLastMonth')}
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            {/* The question asked before any single line: how much was set
                aside this month, and how far into it are we. */}
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{t('budgetTotal')}</span>
                <span className="text-text-muted shrink-0 text-xs tabular-nums">
                  {t('budgetOf', { spent: money(spent), amount: money(budgeted) })}
                </span>
              </div>
              <Progress
                value={budgeted > 0 ? Math.min(100, (spent / budgeted) * 100) : 0}
                tone={over ? 'bad' : spent / budgeted > 0.9 ? 'warn' : 'accent'}
                label={t('budgetTotal')}
              />
              <p className={over ? 'text-bad text-xs' : 'text-text-subtle text-xs'}>
                {over
                  ? t('overBudget', { amount: money(spent - budgeted) })
                  : t('remaining', { amount: money(budgeted - spent) })}
              </p>
            </div>

            <ul className="border-border-base space-y-3 border-t pt-3">
              {month.budgets.map((budget) => {
                const amount = Number(budget.amount)
                const share = amount > 0 ? (budget.spent / amount) * 100 : 0
                const lineOver = budget.spent > amount

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
                      tone={lineOver ? 'bad' : share > 90 ? 'warn' : 'accent'}
                      label={budget.categoryName}
                    />
                    <p className={lineOver ? 'text-bad text-xs' : 'text-text-subtle text-xs'}>
                      {lineOver
                        ? t('overBudget', { amount: money(budget.spent - amount) })
                        : t('remaining', { amount: money(amount - budget.spent) })}
                    </p>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  )
}
