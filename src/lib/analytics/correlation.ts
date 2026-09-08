import {
  CORRELATION_MIN_BUCKET_DAYS,
  CORRELATION_MIN_DAYS,
  CORRELATION_MIN_EFFECT_RATIO,
} from '@/lib/defaults'
import { mean, pearson, strengthOf, terciles, type CorrelationStrength, type Pair } from './stats'

export type BucketSummary = {
  n: number
  mean: number
  /** Inclusive bound description, for the "how this was calculated" panel. */
  label: 'below' | 'at_or_above' | 'low' | 'high'
}

export type ComparisonResult = {
  /** False when a gate failed: nothing is shown to the user in that case. */
  passed: boolean
  reason: 'ok' | 'too_few_days' | 'thin_bucket' | 'effect_too_small'
  n: number
  threshold: number | null
  low: BucketSummary | null
  high: BucketSummary | null
  difference: number | null
  pearson: number | null
  strength: CorrelationStrength
}

/**
 * Spec 18.3 — bucket comparison is primary, because that is the shape the
 * product's own "good example" takes: *"average energy was higher on days with
 * at least 7 hours of sleep"*. Pearson r rides along as a secondary number.
 *
 * Three gates must all pass before anything is displayed. They exist to stop
 * the app from narrating noise: a difference computed from four days is not a
 * finding.
 */
export function compareBuckets({
  pairs,
  threshold,
  outcomeRange,
  minDays = CORRELATION_MIN_DAYS,
  minBucketDays = CORRELATION_MIN_BUCKET_DAYS,
}: {
  /** x = the driver metric, y = the outcome metric. Both non-null. */
  pairs: Pair[]
  /** Natural threshold on x (e.g. 7 hours of sleep). Terciles are used if absent. */
  threshold?: number | null
  /** Plausible span of the outcome metric, for the effect-size gate. */
  outcomeRange: number
  minDays?: number
  minBucketDays?: number
}): ComparisonResult {
  const n = pairs.length
  const r = pearson(pairs)
  const base: ComparisonResult = {
    passed: false,
    reason: 'ok',
    n,
    threshold: threshold ?? null,
    low: null,
    high: null,
    difference: null,
    pearson: r,
    strength: strengthOf(r),
  }

  if (n < minDays) return { ...base, reason: 'too_few_days' }

  let lowValues: number[]
  let highValues: number[]
  let usedThreshold: number | null

  if (threshold !== null && threshold !== undefined) {
    usedThreshold = threshold
    lowValues = pairs.filter((pair) => pair.x < threshold).map((pair) => pair.y)
    highValues = pairs.filter((pair) => pair.x >= threshold).map((pair) => pair.y)
  } else {
    const cuts = terciles(pairs.map((pair) => pair.x))
    if (!cuts) return { ...base, reason: 'too_few_days' }
    usedThreshold = null
    lowValues = pairs.filter((pair) => pair.x <= cuts.low).map((pair) => pair.y)
    highValues = pairs.filter((pair) => pair.x >= cuts.high).map((pair) => pair.y)
  }

  if (lowValues.length < minBucketDays || highValues.length < minBucketDays) {
    return { ...base, reason: 'thin_bucket' }
  }

  const lowMean = mean(lowValues)
  const highMean = mean(highValues)
  if (lowMean === null || highMean === null) return { ...base, reason: 'thin_bucket' }

  const difference = highMean - lowMean
  if (Math.abs(difference) < outcomeRange * CORRELATION_MIN_EFFECT_RATIO) {
    return { ...base, reason: 'effect_too_small', difference }
  }

  return {
    ...base,
    passed: true,
    threshold: usedThreshold,
    low: {
      n: lowValues.length,
      mean: round2(lowMean),
      label: usedThreshold === null ? 'low' : 'below',
    },
    high: {
      n: highValues.length,
      mean: round2(highMean),
      label: usedThreshold === null ? 'high' : 'at_or_above',
    },
    difference: round2(difference),
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100
