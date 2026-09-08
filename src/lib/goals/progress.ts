import { diffDays, type ISODate } from '@/lib/dates'

export type GoalProgressInput = {
  progressMode: 'manual' | 'metric' | 'milestones'
  progressManual: number | null
  metricTarget: number | null
  metricDirection: 'at_least' | 'at_most' | null
  /** Aggregated actual value for the goal's metric over its period. */
  metricActual: number | null
  milestones: { completed: boolean; weight: number }[]
  startDate: ISODate
  targetDate: ISODate | null
}

export type Pace = 'ahead' | 'on_track' | 'behind' | 'no_deadline' | 'not_started'

export type GoalProgress = {
  /** 0..100, or null when the mode has nothing to compute from. */
  percent: number | null
  actual: number | null
  target: number | null
  pace: Pace
  /** Fraction of the goal window elapsed, 0..1. */
  timeElapsed: number | null
  daysRemaining: number | null
  /** Units per day still required to finish on time. */
  requiredRate: number | null
}

/**
 * Spec 8.2. `at_most` goals get full credit at or below target and zero at
 * double it, so "keep entertainment under 10h/week" degrades gracefully instead
 * of flipping between 0 and 100.
 */
export function computeGoalProgress(input: GoalProgressInput, today: ISODate): GoalProgress {
  const percent = computePercent(input)
  const timing = computeTiming(input, today)
  const target = input.metricTarget
  const actual = input.metricActual

  let requiredRate: number | null = null
  if (
    input.progressMode === 'metric' &&
    input.metricDirection === 'at_least' &&
    target !== null &&
    timing.daysRemaining !== null &&
    timing.daysRemaining > 0
  ) {
    requiredRate = Math.max(0, (target - (actual ?? 0)) / timing.daysRemaining)
  }

  return {
    percent,
    actual,
    target,
    pace: computePace(percent, timing.timeElapsed),
    timeElapsed: timing.timeElapsed,
    daysRemaining: timing.daysRemaining,
    requiredRate,
  }
}

function computePercent(input: GoalProgressInput): number | null {
  switch (input.progressMode) {
    case 'manual':
      return input.progressManual === null ? null : clampPercent(input.progressManual)

    case 'metric': {
      const { metricTarget: target, metricActual: actual, metricDirection } = input
      if (target === null || target <= 0) return null
      if (actual === null) return 0
      if (metricDirection === 'at_most') {
        return clampPercent(100 * clamp01(2 - actual / target))
      }
      return clampPercent(100 * clamp01(actual / target))
    }

    case 'milestones': {
      if (input.milestones.length === 0) return null
      const total = input.milestones.reduce((sum, m) => sum + m.weight, 0)
      if (total <= 0) return null
      const done = input.milestones
        .filter((m) => m.completed)
        .reduce((sum, m) => sum + m.weight, 0)
      return clampPercent((100 * done) / total)
    }
  }
}

function computeTiming(
  input: GoalProgressInput,
  today: ISODate,
): { timeElapsed: number | null; daysRemaining: number | null } {
  if (!input.targetDate) return { timeElapsed: null, daysRemaining: null }

  const totalDays = diffDays(input.targetDate, input.startDate) + 1
  if (totalDays <= 0) return { timeElapsed: 1, daysRemaining: 0 }

  const elapsedDays = diffDays(today, input.startDate) + 1
  return {
    timeElapsed: clamp01(elapsedDays / totalDays),
    daysRemaining: Math.max(0, diffDays(input.targetDate, today)),
  }
}

/** A 10-point tolerance band keeps the indicator from flickering day to day. */
function computePace(percent: number | null, timeElapsed: number | null): Pace {
  if (timeElapsed === null) return 'no_deadline'
  if (percent === null) return 'not_started'
  const expected = timeElapsed * 100
  if (percent >= expected + 10) return 'ahead'
  if (percent <= expected - 10) return 'behind'
  return 'on_track'
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const clampPercent = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 100) / 100
