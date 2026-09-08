import { describe, expect, it } from 'vitest'
import { computeGoalProgress, type GoalProgressInput } from '@/lib/goals/progress'

const base: GoalProgressInput = {
  progressMode: 'manual',
  progressManual: null,
  metricTarget: null,
  metricDirection: null,
  metricActual: null,
  milestones: [],
  startDate: '2026-09-01',
  targetDate: null,
}

describe('manual mode', () => {
  it('uses the stored percentage and clamps it', () => {
    expect(computeGoalProgress({ ...base, progressManual: 42 }, '2026-09-07').percent).toBe(42)
    expect(computeGoalProgress({ ...base, progressManual: 140 }, '2026-09-07').percent).toBe(100)
  })

  it('returns null when no progress has been set', () => {
    expect(computeGoalProgress(base, '2026-09-07').percent).toBeNull()
  })
})

describe('metric mode', () => {
  const metric: GoalProgressInput = {
    ...base,
    progressMode: 'metric',
    metricTarget: 300,
    metricDirection: 'at_least',
    metricActual: 214,
  }

  it('computes at_least progress as a share of target', () => {
    const result = computeGoalProgress(metric, '2026-09-07')
    expect(result.percent).toBeCloseTo(71.33, 1)
    expect(result.actual).toBe(214)
    expect(result.target).toBe(300)
  })

  it('caps at_least progress at 100', () => {
    expect(computeGoalProgress({ ...metric, metricActual: 900 }, '2026-09-07').percent).toBe(100)
  })

  it('gives at_most goals full credit at or below target', () => {
    const atMost = { ...metric, metricDirection: 'at_most' as const, metricTarget: 600 }
    expect(computeGoalProgress({ ...atMost, metricActual: 400 }, '2026-09-07').percent).toBe(100)
    expect(computeGoalProgress({ ...atMost, metricActual: 600 }, '2026-09-07').percent).toBe(100)
  })

  it('degrades at_most progress linearly to zero at double the target', () => {
    const atMost = { ...metric, metricDirection: 'at_most' as const, metricTarget: 600 }
    expect(computeGoalProgress({ ...atMost, metricActual: 900 }, '2026-09-07').percent).toBe(50)
    expect(computeGoalProgress({ ...atMost, metricActual: 1200 }, '2026-09-07').percent).toBe(0)
    expect(computeGoalProgress({ ...atMost, metricActual: 5000 }, '2026-09-07').percent).toBe(0)
  })

  it('treats an absent actual as zero progress, not as unknown', () => {
    expect(computeGoalProgress({ ...metric, metricActual: null }, '2026-09-07').percent).toBe(0)
  })

  it('returns null for a misconfigured target', () => {
    expect(computeGoalProgress({ ...metric, metricTarget: 0 }, '2026-09-07').percent).toBeNull()
  })
})

describe('milestone mode', () => {
  it('weights milestones', () => {
    const result = computeGoalProgress(
      {
        ...base,
        progressMode: 'milestones',
        milestones: [
          { completed: true, weight: 1 },
          { completed: true, weight: 1 },
          { completed: false, weight: 2 },
        ],
      },
      '2026-09-07',
    )
    expect(result.percent).toBe(50)
  })

  it('returns null with no milestones at all', () => {
    expect(
      computeGoalProgress({ ...base, progressMode: 'milestones' }, '2026-09-07').percent,
    ).toBeNull()
  })
})

describe('pace', () => {
  it('reports no deadline when there is none', () => {
    expect(computeGoalProgress({ ...base, progressManual: 10 }, '2026-09-07').pace).toBe(
      'no_deadline',
    )
  })

  it('compares progress against elapsed time with a tolerance band', () => {
    const timed = { ...base, progressManual: 50, targetDate: '2026-09-10' }
    // Day 7 of a 10-day window: 70% elapsed, 50% done → behind.
    expect(computeGoalProgress(timed, '2026-09-07').pace).toBe('behind')
    expect(computeGoalProgress({ ...timed, progressManual: 90 }, '2026-09-07').pace).toBe('ahead')
    expect(computeGoalProgress({ ...timed, progressManual: 70 }, '2026-09-07').pace).toBe('on_track')
  })

  it('computes the rate still required to finish on time', () => {
    const result = computeGoalProgress(
      {
        ...base,
        progressMode: 'metric',
        metricTarget: 300,
        metricDirection: 'at_least',
        metricActual: 100,
        targetDate: '2026-09-11',
      },
      '2026-09-07',
    )
    expect(result.daysRemaining).toBe(4)
    expect(result.requiredRate).toBe(50)
  })

  it('never asks for a negative rate once the target is met', () => {
    const result = computeGoalProgress(
      {
        ...base,
        progressMode: 'metric',
        metricTarget: 300,
        metricDirection: 'at_least',
        metricActual: 400,
        targetDate: '2026-09-11',
      },
      '2026-09-07',
    )
    expect(result.requiredRate).toBe(0)
  })
})
