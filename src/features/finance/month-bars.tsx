'use client'

import { useFormatter, useLocale, useTranslations } from 'next-intl'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartTooltip } from '@/components/charts/chart-tooltip'
import { CURSOR_FILL } from '@/components/charts/theme'
import { fromISODate } from '@/lib/dates'
import type { MonthTotals } from '@/lib/finance/report'
import { formatCompactMoney, formatMoney } from '@/lib/format/money'

/**
 * Income beside spending, a pair of bars per month. Side by side rather than
 * stacked: the question this answers is which of the two was bigger, and a
 * stack hides exactly that.
 *
 * The colours are the app's own `--good` and `--bad`, read straight from CSS so
 * the chart follows whichever theme is on without being told about it.
 */
export function MonthBars({ months, currency }: { months: MonthTotals[]; currency: string }) {
  const t = useTranslations('finance')
  const format = useFormatter()
  const locale = useLocale()

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={months} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: 'var(--text-subtle)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            tickFormatter={(value: string) => format.dateTime(fromISODate(value), 'monthShort')}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--text-subtle)' }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => formatCompactMoney(value, currency, locale)}
          />
          <Tooltip
            cursor={{ fill: CURSOR_FILL }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const month = payload[0]?.payload as MonthTotals | undefined
              if (!month) return null

              return (
                <ChartTooltip>
                  <div className="text-text-subtle">
                    {format.dateTime(fromISODate(month.month), 'monthYear')}
                  </div>
                  <div className="text-good tabular-nums">
                    {t('income')} {formatMoney(month.income, currency, locale)}
                  </div>
                  <div className="text-bad tabular-nums">
                    {t('expense')} {formatMoney(month.expense, currency, locale)}
                  </div>
                  <div className="font-medium tabular-nums">
                    {t('net')} {formatMoney(month.net, currency, locale)}
                  </div>
                </ChartTooltip>
              )
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            // Money in, then money out. Left alone, the legend sorts itself by
            // name and puts them in whatever order the locale's alphabet gives.
            itemSorter={null}
            wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }}
          />
          <Bar
            dataKey="income"
            name={t('income')}
            fill="var(--good)"
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="expense"
            name={t('expense')}
            fill="var(--bad)"
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
