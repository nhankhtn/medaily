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
import { SERIES_COLORS, type SeriesKey } from '@/components/charts/theme'
import { useChartMode } from '@/components/charts/use-chart-mode'
import { fromISODate } from '@/lib/dates'
import type { MetricSeries } from '@/server/services/analytics'

/**
 * A single metric over the range: the raw daily line plus its 7-day trailing
 * average, drawn in the same hue at different weights. One y-axis, gaps left
 * as gaps.
 */
export function MetricChart({
  series,
  title,
  seriesKey,
  unit,
}: {
  series: MetricSeries
  title: string
  seriesKey: SeriesKey
  unit?: string
}) {
  const mode = useChartMode()
  const color = SERIES_COLORS[mode][seriesKey]
  const format = useFormatter()
  const t = useTranslations('analytics')

  const hasData = series.points.filter((point) => point.value !== null).length >= 2

  return (
    <figure className="rounded-[var(--radius)] border border-border-base bg-surface p-4">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <span className="flex items-center gap-3 text-xs text-text-subtle">
          {series.total !== null ? (
            <span className="tabular-nums">
              {t('total')} {Math.round(series.total)}
              {unit ? ` ${unit}` : ''}
            </span>
          ) : null}
          {series.average !== null ? (
            <span className="tabular-nums">
              ø {series.average}
              {unit ? ` ${unit}` : ''}
            </span>
          ) : null}
          {series.delta !== null ? (
            <span
              className={
                series.delta === 0 ? 'text-text-subtle' : series.delta > 0 ? 'text-good' : 'text-bad'
              }
            >
              {series.delta > 0 ? '+' : ''}
              {Math.round(series.delta * 10) / 10}
            </span>
          ) : null}
        </span>
      </figcaption>

      <div className="h-40">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series.points} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
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
              />
              <Tooltip
                cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const point = payload[0]?.payload as MetricSeries['points'][number] | undefined
                  if (!point) return null
                  return (
                    <div className="rounded-md border border-border-base bg-surface px-2 py-1 text-xs shadow-[var(--shadow-card)]">
                      <div className="text-text-subtle">
                        {format.dateTime(fromISODate(point.date), {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </div>
                      <div className="font-medium tabular-nums">
                        {point.value === null ? '—' : point.value}
                        {unit && point.value !== null ? ` ${unit}` : ''}
                      </div>
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
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-text-subtle">
            {t('notEnoughData')}
          </div>
        )}
      </div>
    </figure>
  )
}
