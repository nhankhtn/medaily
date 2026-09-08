'use client'

import { useFormatter } from 'next-intl'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fromISODate } from '@/lib/dates'
import { SERIES_COLORS, type SeriesKey } from './theme'
import { useChartMode } from './use-chart-mode'

export type FacetPoint = { date: string; value: number | null }

/**
 * One metric, one facet, its own title. Small multiples instead of a single
 * crowded chart — and never a second y-axis (dataviz: one axis, always).
 *
 * Missing days break the line (`connectNulls={false}`): an unlogged day is not
 * a zero, and the chart must not imply otherwise.
 */
export function SparklineFacet({
  title,
  points,
  seriesKey,
  unit,
  average,
}: {
  title: string
  points: FacetPoint[]
  seriesKey: SeriesKey
  unit?: string
  average?: number | null
}) {
  const mode = useChartMode()
  const color = SERIES_COLORS[mode][seriesKey]
  const format = useFormatter()

  const present = points.filter((point) => point.value !== null)
  const hasData = present.length >= 2

  return (
    <figure className="rounded-[var(--radius)] border border-border-base bg-surface p-3">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-text-muted">{title}</span>
        {average !== null && average !== undefined ? (
          <span className="text-xs tabular-nums text-text-subtle">
            ø {formatValue(average)}
            {unit ? ` ${unit}` : ''}
          </span>
        ) : null}
      </figcaption>

      <div className="h-20">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="date" hide />
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip
                cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const point = payload[0]?.payload as FacetPoint | undefined
                  if (!point || point.value === null) return null
                  return (
                    <div className="rounded-md border border-border-base bg-surface px-2 py-1 text-xs shadow-[var(--shadow-card)]">
                      <div className="text-text-subtle">
                        {format.dateTime(fromISODate(point.date), {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </div>
                      <div className="font-medium tabular-nums text-text">
                        {formatValue(point.value)}
                        {unit ? ` ${unit}` : ''}
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
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-text-subtle">—</div>
        )}
      </div>
    </figure>
  )
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
