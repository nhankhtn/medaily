'use client'

import type { BindableMetric } from '@/lib/metrics/bindable'

/**
 * The options of a metric select: what the app measures, and what this person
 * added themselves. Grouped only when there is a second group to name.
 */
export function MetricOptions({
  builtIn,
  own,
  t,
}: {
  builtIn: BindableMetric[]
  own: BindableMetric[]
  t: (key: 'builtInMetrics' | 'ownMetrics') => string
}) {
  const options = (list: BindableMetric[]) =>
    list.map((option) => (
      <option key={option.key} value={option.key}>
        {option.label}
      </option>
    ))

  if (own.length === 0) return <>{options(builtIn)}</>

  return (
    <>
      <optgroup label={t('builtInMetrics')}>{options(builtIn)}</optgroup>
      <optgroup label={t('ownMetrics')}>{options(own)}</optgroup>
    </>
  )
}
