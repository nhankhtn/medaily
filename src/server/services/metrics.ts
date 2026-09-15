import { isMetricKey } from '@/server/repositories/goals'
import { aggregateMetric } from '@/server/repositories/goals'
import { aggregateCustomMetric } from '@/server/repositories/custom-metrics'
import type { DateRange } from '@/lib/dates'
import { bindableCustomMetrics, type BindableMetric } from '@/lib/metrics/bindable'
import { findCustomMetrics } from '@/server/repositories/custom-metrics'
import { getSettings } from '@/server/services/settings'

export type MetricAggregation = 'sum' | 'avg' | 'count_days' | 'latest'

/**
 * A goal names its metric by key without caring where the number lives. The
 * built-in ones are columns on `v_daily_effective`; the user's own are rows in
 * `custom_metric_values`, so the lookup forks here rather than in every caller.
 */
export async function aggregateAnyMetric(
  userId: string,
  key: string,
  aggregation: MetricAggregation,
  range: DateRange,
): Promise<number | null> {
  return isMetricKey(key)
    ? aggregateMetric(userId, key, aggregation, range)
    : aggregateCustomMetric(userId, key, aggregation, range)
}

/**
 * The metrics this person can point a habit or a goal at: the built-in ones,
 * plus their own that carry a number. Labelled in the language they read, so
 * the form can render a select without a second lookup.
 */
export async function bindableMetrics(userId: string): Promise<BindableMetric[]> {
  const settings = await getSettings()
  return bindableCustomMetrics(await findCustomMetrics(userId), settings.locale)
}

/**
 * Whether a key is one this person may bind to. A built-in always is; a custom
 * one has to be theirs, still tracked, and hold a number — which is the same
 * question the select answers, asked again on the way in.
 */
export async function canBindMetric(userId: string, key: string): Promise<boolean> {
  if (isMetricKey(key)) return true
  const own = await bindableMetrics(userId)
  return own.some((metric) => metric.key === key)
}
