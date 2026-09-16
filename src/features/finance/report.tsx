import { getLocale, getTranslations } from 'next-intl/server'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { StatRow } from '@/components/ui/page'
import { CategoryPie } from '@/features/finance/category-pie'
import { CategoryRanking } from '@/features/finance/category-ranking'
import { MonthBars } from '@/features/finance/month-bars'
import { PeriodPicker } from '@/features/finance/period-picker'
import { foldSlices } from '@/lib/finance/report'
import { formatDayMonth } from '@/lib/format/dates'
import { formatMoney } from '@/lib/format/money'
import type { FinanceReport } from '@/server/services/finance-report'

/**
 * What the numbers add up to, as opposed to the overview tab's ledger: the
 * stretch you picked, the run of months around it, where the money went, and
 * the few expenses big enough to explain the rest.
 */
export async function Report({ report }: { report: FinanceReport }) {
  const [t, locale] = await Promise.all([getTranslations('finance'), getLocale()])
  const money = (amount: number) => formatMoney(amount, report.currency, locale)
  const { totals, period } = report

  const slices = foldSlices(report.spend, t('report.otherCategories'))
  const spent = report.spend.reduce((total, row) => total + row.total, 0)

  return (
    <div className="space-y-4">
      {/* The picker stays put whether or not the period holds anything — with
          nothing recorded, being able to pick another one is the way out. */}
      <PeriodPicker period={period} years={report.years} />

      {!report.hasData ? (
        <Card>
          <CardBody className="py-8 text-center">
            <p className="font-medium">{t('report.emptyPeriod')}</p>
            <p className="text-text-subtle mx-auto mt-1 max-w-prose text-sm">
              {t('report.emptyPeriodBody')}
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <StatRow
            items={[
              { label: t('income'), value: money(totals.income) },
              { label: t('expense'), value: money(totals.expense) },
              { label: t('net'), value: money(totals.net) },
              {
                label: t('report.savingsRate'),
                value: totals.savingsRate === null ? '—' : `${Math.round(totals.savingsRate)}%`,
                hint: totals.savingsRate === null ? t('report.noIncomeYet') : t('report.ofIncome'),
              },
            ]}
          />

          <Card>
            <CardHeader title={t('report.monthlyFlow')} />
            <CardBody>
              <MonthBars months={report.months} currency={report.currency} />
              <p className="text-text-subtle mt-2 text-xs">{comparison(report, money, t)}</p>
            </CardBody>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="min-w-0">
              <CardHeader title={t('report.byCategory')} />
              <CardBody>
                {slices.length === 0 ? (
                  <p className="text-text-subtle text-sm">{t('report.noSpend')}</p>
                ) : (
                  <>
                    <CategoryPie slices={slices} currency={report.currency} total={spent} />
                    <CategoryRanking slices={slices} currency={report.currency} />
                  </>
                )}
              </CardBody>
            </Card>

            <Card className="min-w-0">
              <CardHeader title={t('report.largest')} />
              <CardBody>
                {report.largest.length === 0 ? (
                  <p className="text-text-subtle text-sm">{t('report.noSpend')}</p>
                ) : (
                  <ul className="divide-border-base divide-y">
                    {report.largest.map((expense) => (
                      <li key={expense.id} className="flex items-baseline gap-2 py-2">
                        <span className="text-text-subtle w-11 shrink-0 text-xs tabular-nums">
                          {formatDayMonth(expense.occurredOn)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {expense.label || expense.categoryName || t('noCategory')}
                        </span>
                        <span className="shrink-0 text-sm tabular-nums">
                          {money(expense.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * The sentence under the trend. A month is held up against what a normal month
 * costs; a whole year against the year before, since a year has no monthly
 * average of its own to be compared with.
 */
function comparison(
  report: FinanceReport,
  money: (amount: number) => string,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  const { totals, period } = report

  if (period.month === null) {
    if (totals.previousExpense === 0) return t('report.firstYear')
    const gap = totals.expense - totals.previousExpense
    const before = money(totals.previousExpense)
    if (gap === 0) return t('report.likePreviousYear', { amount: before })
    return gap > 0
      ? t('report.overPreviousYear', { amount: money(gap), before })
      : t('report.underPreviousYear', { amount: money(-gap), before })
  }

  const average = totals.averageExpense
  if (average === null) return t('report.firstMonth')

  const gap = totals.expense - average
  if (gap === 0) return t('report.likeUsual', { amount: money(average) })
  return gap > 0
    ? t('report.overAverage', { amount: money(gap), average: money(average) })
    : t('report.underAverage', { amount: money(-gap), average: money(average) })
}
