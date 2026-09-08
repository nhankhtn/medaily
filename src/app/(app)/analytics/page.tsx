import { getTranslations } from 'next-intl/server'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { ComparisonCard } from '@/features/analytics/comparison-card'
import { MetricChart } from '@/features/analytics/metric-chart'
import { RangePicker } from '@/features/analytics/range-picker'
import { ANALYTICS_RANGES, type AnalyticsRange } from '@/lib/analytics/ranges'
import { getAnalyticsData } from '@/server/services/analytics'

const CHARTS = [
  { key: 'focus_minutes', labelKey: 'focus', seriesKey: 'focus', unit: 'min' },
  { key: 'sleep_hours', labelKey: 'sleep', seriesKey: 'sleep', unit: 'h' },
  { key: 'energy', labelKey: 'energy', seriesKey: 'energy', unit: undefined },
  { key: 'entertainment_minutes', labelKey: 'entertainment', seriesKey: 'entertainment', unit: 'min' },
] as const

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { range: rangeParam } = await searchParams
  const parsed = Number(rangeParam)
  const range: AnalyticsRange = (ANALYTICS_RANGES as readonly number[]).includes(parsed)
    ? (parsed as AnalyticsRange)
    : 30

  const [t, tm, data] = await Promise.all([
    getTranslations('analytics'),
    getTranslations('metrics'),
    getAnalyticsData(range),
  ])

  const totalTracked = data.timeAllocation.reduce((sum, slice) => sum + slice.minutes, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <RangePicker active={range} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {CHARTS.map((chart) => {
          const series = data.series.find((entry) => entry.key === chart.key)
          if (!series) return null
          return (
            <MetricChart
              key={chart.key}
              series={series}
              title={tm(chart.labelKey)}
              seriesKey={chart.seriesKey}
              unit={chart.unit}
            />
          )
        })}
      </div>

      <Card>
        <CardHeader title={t('comparisons')} />
        <CardBody className="space-y-3">
          {data.comparisons.map((comparison) => (
            <ComparisonCard key={comparison.key} comparison={comparison} />
          ))}
          <p className="text-xs leading-snug text-text-subtle">{t('disclaimer')}</p>
        </CardBody>
      </Card>

      {totalTracked > 0 ? (
        <Card>
          <CardHeader title={t('timeAllocation')} />
          <CardBody className="space-y-2">
            {data.timeAllocation.map((slice) => {
              const share = (slice.minutes / totalTracked) * 100
              return (
                <div key={slice.key} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm text-text-muted">
                    {tm(slice.key)}
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${share}%` }}
                    />
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-text-subtle">
                    {Math.round(slice.minutes / 60)}h · {Math.round(share)}%
                  </span>
                </div>
              )
            })}
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
