'use client'

import { useLocale, useTranslations } from 'next-intl'
import { categoryColor } from '@/components/charts/theme'
import { useChartMode } from '@/components/charts/use-chart-mode'
import type { CategorySlice } from '@/lib/finance/report'
import { formatMoney } from '@/lib/format/money'

/**
 * The ranking that reads the ring: same order, same colours. The dot is what
 * ties a row to its slice, and the name and amount are what make the chart
 * legible to someone who cannot tell the slices apart by colour.
 */
export function CategoryRanking({
  slices,
  currency,
}: {
  slices: CategorySlice[]
  currency: string
}) {
  const mode = useChartMode()
  const locale = useLocale()
  const t = useTranslations('finance')

  return (
    <ul className="divide-border-base mt-2 divide-y">
      {slices.map((slice, index) => {
        const change = slice.total - slice.previous

        return (
          // Name and amount on one line, the smaller print under it. No fixed
          // columns: two of them were enough to push the card wider than a
          // phone, which scrolled the whole page sideways.
          <li key={slice.id ?? `rest-${index}`} className="min-w-0 py-1.5">
            <div className="flex items-baseline gap-2">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: categoryColor(mode, index) }}
              />
              <span className="min-w-0 flex-1 truncate text-sm">
                {slice.id === null && !slice.rest ? t('noCategory') : slice.name}
              </span>
              <span className="shrink-0 text-sm tabular-nums">
                {formatMoney(slice.total, currency, locale)}
              </span>
            </div>
            <div className="text-text-subtle flex items-baseline justify-between gap-2 pl-4 text-xs">
              <span className="tabular-nums">
                {t('report.share', { percent: Math.round(slice.share) })}
              </span>
              <span
                className={
                  slice.previous === 0
                    ? 'text-text-subtle truncate'
                    : change > 0
                      ? 'text-bad truncate'
                      : change < 0
                        ? 'text-good truncate'
                        : 'text-text-subtle truncate'
                }
              >
                {slice.previous === 0
                  ? t('report.newThisPeriod')
                  : change > 0
                    ? t('report.upFromLast', { amount: formatMoney(change, currency, locale) })
                    : change < 0
                      ? t('report.downFromLast', { amount: formatMoney(-change, currency, locale) })
                      : t('report.sameAsLast')}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
