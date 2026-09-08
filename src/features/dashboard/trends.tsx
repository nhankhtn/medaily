'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { SparklineFacet } from '@/components/charts/sparkline-facet'
import type { TrendPoint } from '@/server/services/dashboard'
import { cn } from '@/lib/utils'

const RANGES = [7, 30] as const

/**
 * Four small multiples, each a single series with its own title — never one
 * crowded chart, and never two y-axes on one plot.
 */
export function Trends({ points }: { points: TrendPoint[] }) {
  const t = useTranslations('dashboard')
  const tm = useTranslations('metrics')
  const tc = useTranslations('common')
  const [days, setDays] = useState<(typeof RANGES)[number]>(7)

  const visible = points.slice(-days)
  const hasAny = visible.some((point) => point.focusMinutes !== null || point.energy !== null)

  const average = (selector: (point: TrendPoint) => number | null) => {
    const values = visible.map(selector).filter((value): value is number => value !== null)
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  }

  return (
    <div className="px-4 pb-4">
      <div className="mb-3 flex gap-1">
        {RANGES.map((range) => (
          <button
            key={range}
            type="button"
            onClick={() => setDays(range)}
            aria-pressed={days === range}
            className={cn(
              'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
              days === range
                ? 'border-transparent bg-accent text-accent-text'
                : 'border-border-base bg-surface-2 text-text-muted hover:border-border-strong',
            )}
          >
            {range === 7 ? t('range7') : t('range30')}
          </button>
        ))}
      </div>

      {hasAny ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SparklineFacet
            title={tm('focus')}
            seriesKey="focus"
            unit={tc('min')}
            points={visible.map((point) => ({ date: point.date, value: point.focusMinutes }))}
            average={average((point) => point.focusMinutes)}
          />
          <SparklineFacet
            title={tm('sleep')}
            seriesKey="sleep"
            unit={tc('hoursShort')}
            points={visible.map((point) => ({ date: point.date, value: point.sleepHours }))}
            average={average((point) => point.sleepHours)}
          />
          <SparklineFacet
            title={tm('energy')}
            seriesKey="energy"
            points={visible.map((point) => ({ date: point.date, value: point.energy }))}
            average={average((point) => point.energy)}
          />
          <SparklineFacet
            title={tm('entertainment')}
            seriesKey="entertainment"
            unit={tc('min')}
            points={visible.map((point) => ({
              date: point.date,
              value: point.entertainmentMinutes,
            }))}
            average={average((point) => point.entertainmentMinutes)}
          />
        </div>
      ) : (
        <p className="text-sm text-text-subtle">{t('emptyTrends')}</p>
      )}
    </div>
  )
}
