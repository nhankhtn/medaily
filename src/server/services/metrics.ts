import { isMetricKey } from '@/server/repositories/goals'
import { aggregateMetric } from '@/server/repositories/goals'
import { aggregateCustomMetric } from '@/server/repositories/custom-metrics'
import type { DateRange } from '@/lib/dates'

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
