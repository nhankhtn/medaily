'use client'

import { useRouter } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { Select } from '@/components/ui/select'
import { formatPeriod, type Period } from '@/lib/finance/report'
import { PATHS } from '@/lib/paths'

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/**
 * Which stretch the report is about. Two native selects rather than a row of
 * pills: twelve months and several years is more than a row can hold, and on a
 * phone a select opens the platform's own picker.
 *
 * Changing either one is a navigation, because the period lives in the URL —
 * so a month can be linked to and the back button walks back through the ones
 * that were looked at.
 */
export function PeriodPicker({ period, years }: { period: Period; years: number[] }) {
  const t = useTranslations('finance.report')
  const format = useFormatter()
  const router = useRouter()

  const go = (next: Period) => router.push(PATHS.financeTab('report', formatPeriod(next)))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label={t('year')}
        value={String(period.year)}
        onChange={(event) => go({ ...period, year: Number(event.target.value) })}
        className="h-9 w-auto text-sm"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </Select>

      <Select
        aria-label={t('month')}
        value={period.month === null ? 'all' : String(period.month)}
        onChange={(event) =>
          go({
            ...period,
            month: event.target.value === 'all' ? null : Number(event.target.value),
          })
        }
        className="h-9 w-auto text-sm"
      >
        <option value="all">{t('wholeYear')}</option>
        {/* The month's own name in the locale, rather than twelve more
            strings to keep in step across two files. */}
        {MONTHS.map((month) => (
          <option key={month} value={month}>
            {format.dateTime(new Date(Date.UTC(2000, month - 1, 1)), 'month')}
          </option>
        ))}
      </Select>
    </div>
  )
}
