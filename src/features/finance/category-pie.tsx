'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { categoryColor } from '@/components/charts/theme'
import { useChartMode } from '@/components/charts/use-chart-mode'
import type { CategorySlice } from '@/lib/finance/report'
import { formatMoney } from '@/lib/format/money'

/**
 * Spending split by category, so which one takes the most is one glance rather
 * than a column of numbers to compare.
 *
 * A ring, not a full pie: the hole carries the total, which is the number every
 * share is a share of, and it is the one figure a pie otherwise leaves out.
 * The slices are unlabelled on purpose — the ranking beside the chart names
 * each one with its exact amount, and labels on thin slices only collide.
 */
export function CategoryPie({
  slices,
  currency,
  total,
}: {
  slices: CategorySlice[]
  currency: string
  total: number
}) {
  const mode = useChartMode()
  const locale = useLocale()
  const t = useTranslations('finance')

  return (
    <div className="relative h-52 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="total"
            nameKey="name"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={slices.length > 1 ? 1 : 0}
            stroke="var(--surface)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {slices.map((slice, index) => (
              <Cell key={slice.id ?? `rest-${index}`} fill={categoryColor(mode, index)} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const slice = payload[0]?.payload as CategorySlice | undefined
              if (!slice) return null

              return (
                <div className="border-border-base bg-surface rounded-md border px-2 py-1 text-xs shadow-[var(--shadow-card)]">
                  <div className="font-medium">
                    {slice.id === null && !slice.rest ? t('noCategory') : slice.name}
                  </div>
                  <div className="tabular-nums">{formatMoney(slice.total, currency, locale)}</div>
                  <div className="text-text-subtle tabular-nums">
                    {t('report.share', { percent: Math.round(slice.share) })}
                  </div>
                </div>
              )
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* The hole is the only place the whole is worth putting. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-text-subtle text-xs">{t('report.spentInAll')}</span>
        <span className="text-base font-semibold tabular-nums">
          {formatMoney(total, currency, locale)}
        </span>
      </div>
    </div>
  )
}
