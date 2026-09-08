import { describe, expect, it } from 'vitest'
import {
  computeCompletion,
  evaluateLink,
  isScheduledOn,
  periodsIn,
  type HabitSchedule,
} from '@/lib/habits/schedule'

const base: HabitSchedule = {
  frequencyType: 'daily',
  targetCount: 1,
  weekdays: null,
  intervalDays: null,
  startDate: '2026-09-01',
  endDate: null,
}

describe('isScheduledOn', () => {
  it('respects the active window', () => {
    expect(isScheduledOn(base, '2026-08-31')).toBe(false)
    expect(isScheduledOn(base, '2026-09-01')).toBe(true)
    expect(isScheduledOn({ ...base, endDate: '2026-09-10' }, '2026-09-11')).toBe(false)
  })

  it('schedules specific weekdays only', () => {
    // 2026-09-07 is a Monday.
    const habit = { ...base, frequencyType: 'specific_days' as const, weekdays: [1, 3, 5] }
    expect(isScheduledOn(habit, '2026-09-07')).toBe(true)
    expect(isScheduledOn(habit, '2026-09-08')).toBe(false)
    expect(isScheduledOn(habit, '2026-09-09')).toBe(true)
  })

  it('schedules on the interval grid from the start date', () => {
    const habit = { ...base, frequencyType: 'interval' as const, intervalDays: 7 }
    expect(isScheduledOn(habit, '2026-09-01')).toBe(true)
    expect(isScheduledOn(habit, '2026-09-07')).toBe(false)
    expect(isScheduledOn(habit, '2026-09-08')).toBe(true)
  })
})

describe('periodsIn', () => {
  it('gives one period per week for weekly habits', () => {
    const habit = { ...base, frequencyType: 'weekly' as const, targetCount: 4 }
    // Sep 1 2026 is a Tuesday and Sep 21 is a Monday, so the range touches
    // four ISO weeks: Aug 31, Sep 7, Sep 14 and Sep 21.
    const periods = periodsIn(habit, { start: '2026-09-01', end: '2026-09-21' }, 'monday')
    expect(periods).toHaveLength(4)
    expect(periods[0]?.start).toBe('2026-08-31')
    expect(periods.at(-1)?.start).toBe('2026-09-21')
  })

  it('gives one period per scheduled day otherwise', () => {
    const habit = { ...base, frequencyType: 'specific_days' as const, weekdays: [6, 7] }
    const periods = periodsIn(habit, { start: '2026-09-01', end: '2026-09-14' }, 'monday')
    expect(periods).toHaveLength(4)
  })
})

describe('computeCompletion', () => {
  it('never counts unscheduled days against the rate', () => {
    const habit = { ...base, frequencyType: 'specific_days' as const, weekdays: [1] }
    const counts = new Map([['2026-09-07', 1]])
    const result = computeCompletion(habit, { start: '2026-09-01', end: '2026-09-13' }, counts, 'monday')
    // Two Mondays in range (Sep 7 only, since Sep 1 is a Tuesday) → 1 of 1.
    expect(result.scheduledPeriods).toBe(1)
    expect(result.completedPeriods).toBe(1)
    expect(result.rate).toBe(1)
  })

  it('sums counts across a weekly period against the target', () => {
    const habit = { ...base, frequencyType: 'weekly' as const, targetCount: 4 }
    const counts = new Map([
      ['2026-09-07', 1],
      ['2026-09-08', 1],
      ['2026-09-10', 2],
    ])
    const result = computeCompletion(habit, { start: '2026-09-07', end: '2026-09-13' }, counts, 'monday')
    expect(result.completedPeriods).toBe(1)
  })

  it('returns null rather than 0% when nothing was scheduled', () => {
    const habit = { ...base, startDate: '2026-10-01' }
    const result = computeCompletion(habit, { start: '2026-09-01', end: '2026-09-07' }, new Map(), 'monday')
    expect(result.rate).toBeNull()
  })

  it('requires the daily target count to be met', () => {
    const habit = { ...base, targetCount: 3 }
    const counts = new Map([
      ['2026-09-01', 3],
      ['2026-09-02', 2],
    ])
    const result = computeCompletion(habit, { start: '2026-09-01', end: '2026-09-02' }, counts, 'monday')
    expect(result.completedPeriods).toBe(1)
    expect(result.scheduledPeriods).toBe(2)
  })
})

describe('evaluateLink', () => {
  it('compares in the requested direction', () => {
    expect(evaluateLink('gte', 7, 7)).toBe(true)
    expect(evaluateLink('gte', 7, 6.9)).toBe(false)
    expect(evaluateLink('lte', 60, 60)).toBe(true)
    expect(evaluateLink('lte', 60, 61)).toBe(false)
    expect(evaluateLink('eq', 1, 1)).toBe(true)
  })

  it('never completes from a missing value', () => {
    expect(evaluateLink('lte', 60, null)).toBe(false)
    expect(evaluateLink('gte', 0, null)).toBe(false)
  })
})
