'use client'

import { useFormatter, useTranslations } from 'next-intl'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SERIES_COLORS } from '@/components/charts/theme'
import { useChartMode } from '@/components/charts/use-chart-mode'
import { fromISODate } from '@/lib/dates'

/** Weight against its 7-day average — a single day's reading is mostly water. */
export function WeightChart({
  points,
}: {
  points: { date: string; value: number | null; average: number | null }[]
}) {
  const mode = useChartMode()
  const color = SERIES_COLORS[mode].sleep
  const format = useFormatter()
  const t = useTranslations('health')

  if (points.filter((point) => point.value !== null).length < 2) {
    return <p className="text-sm text-text-subtle">{t('noMeasurements')}</p>
  }

  return (
    <figure>
      <figcaption className="mb-2 text-xs text-text-muted">{t('weightTrend')}</figcaption>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--text-subtle)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              minTickGap={32}
              tickFormatter={(value: string) =>
                format.dateTime(fromISODate(value), { day: 'numeric', month: 'short' })
              }
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-subtle)' }}
              tickLine={false}
              axisLine={false}
              width={44}
              domain={['dataMin - 1', 'dataMax + 1']}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const point = payload[0]?.payload as (typeof points)[number] | undefined
                if (!point) return null
                return (
                  <div className="rounded-md border border-border-base bg-surface px-2 py-1 text-xs shadow-[var(--shadow-card)]">
                    <div className="text-text-subtle">
                      {format.dateTime(fromISODate(point.date), { day: 'numeric', month: 'short' })}
                    </div>
                    <div className="font-medium tabular-nums">{point.value ?? '—'}</div>
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="average"
              stroke={color}
              strokeWidth={1}
              strokeDasharray="4 3"
              strokeOpacity={0.6}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
