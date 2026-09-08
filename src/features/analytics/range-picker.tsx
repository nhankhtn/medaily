'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ANALYTICS_RANGES, type AnalyticsRange } from '@/lib/analytics/ranges'
import { cn } from '@/lib/utils'

/** Filters sit in one row above the charts (dataviz interaction guidance). */
export function RangePicker({ active }: { active: AnalyticsRange }) {
  const t = useTranslations('analytics')
  const router = useRouter()
  const params = useSearchParams()

  return (
    <div className="flex flex-wrap gap-1">
      {ANALYTICS_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={active === range}
          onClick={() => {
            const next = new URLSearchParams(params.toString())
            next.set('range', String(range))
            router.push(`/analytics?${next.toString()}`)
          }}
          className={cn(
            'h-9 rounded-full border px-3.5 text-sm font-medium transition-colors',
            active === range
              ? 'border-transparent bg-accent text-accent-text'
              : 'border-border-base bg-surface text-text-muted hover:border-border-strong',
          )}
        >
          {t(`range.${range}`)}
        </button>
      ))}
    </div>
  )
}
