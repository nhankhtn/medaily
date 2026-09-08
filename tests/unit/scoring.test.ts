import { describe, expect, it } from 'vitest'
import { DEFAULT_SCORE_TARGETS, DEFAULT_SCORE_WEIGHTS } from '@/lib/defaults'
import {
  computeDayScore,
  computePeriodScore,
  entertainmentScore,
  exerciseScore,
  focusScore,
  habitsScore,
  normalizeWeights,
  readingScore,
  sleepScore,
  weightsAreValid,
} from '@/lib/scoring'

const full = {
  studyMinutes: 60,
  deepWorkMinutes: 120,
  sleepHours: 8,
  exerciseMinutes: 30,
  readingMinutes: 20,
  entertainmentMinutes: 30,
  habitsScheduled: 4,
  habitsCompleted: 4,
  exerciseDaysLast7: 3,
}

describe('sleepScore', () => {
  it('gives full credit inside the ideal band', () => {
    expect(sleepScore(7)).toBe(1)
    expect(sleepScore(8)).toBe(1)
    expect(sleepScore(9)).toBe(1)
  })

  it('ramps up from the floor and never goes negative', () => {
    expect(sleepScore(4)).toBe(0)
    expect(sleepScore(3)).toBe(0)
    expect(sleepScore(5.5)).toBeCloseTo(0.5, 5)
  })

  it('penalises oversleep mildly rather than zeroing it', () => {
    expect(sleepScore(10)).toBeCloseTo(0.8667, 3)
    expect(sleepScore(12)).toBeCloseTo(0.6, 5)
    expect(sleepScore(16)).toBe(0.6)
  })
})

describe('component functions', () => {
  it('splits focus evenly between study and deep work', () => {
    expect(focusScore(60, 120)).toBe(1)
    expect(focusScore(60, 0)).toBe(0.5)
    expect(focusScore(0, 120)).toBe(0.5)
    // Overshooting one half cannot compensate for the other.
    expect(focusScore(600, 0)).toBe(0.5)
  })

  it('grades exercise in bands', () => {
    expect(exerciseScore(45)).toBe(1)
    expect(exerciseScore(20)).toBe(0.7)
    expect(exerciseScore(5)).toBe(0.4)
    expect(exerciseScore(0)).toBe(0)
  })

  it('applies rest-day credit only after a consistent week', () => {
    expect(exerciseScore(0, DEFAULT_SCORE_TARGETS, 4)).toBe(0.7)
    expect(exerciseScore(0, DEFAULT_SCORE_TARGETS, 3)).toBe(0)
    expect(
      exerciseScore(0, { ...DEFAULT_SCORE_TARGETS, restDayCreditEnabled: false }, 6),
    ).toBe(0)
  })

  it('scores entertainment inversely with a linear middle', () => {
    expect(entertainmentScore(0)).toBe(1)
    expect(entertainmentScore(60)).toBe(1)
    expect(entertainmentScore(120)).toBeCloseTo(0.5, 5)
    expect(entertainmentScore(180)).toBe(0)
    expect(entertainmentScore(600)).toBe(0)
  })

  it('caps reading and returns null habits when nothing is scheduled', () => {
    expect(readingScore(30)).toBe(1)
    expect(readingScore(10)).toBe(0.5)
    expect(habitsScore(0, 0)).toBeNull()
    expect(habitsScore(2, 4)).toBe(0.5)
  })
})

describe('computeDayScore', () => {
  it('scores a complete good day at 100', () => {
    const result = computeDayScore(full)
    expect(result.score).toBe(100)
    expect(result.componentsUsed).toBe(6)
    expect(result.weightUsed).toBe(100)
  })

  it('re-normalizes instead of treating missing data as zero', () => {
    const partial = computeDayScore({
      ...full,
      readingMinutes: null,
      entertainmentMinutes: null,
      habitsScheduled: null,
      habitsCompleted: null,
    })
    // Only focus, sleep and exercise had data — all perfect, so still 100.
    expect(partial.score).toBe(100)
    expect(partial.componentsUsed).toBe(3)
    expect(partial.weightUsed).toBe(65)
  })

  it('returns null when the day has no scoreable data at all', () => {
    const empty = computeDayScore({
      studyMinutes: null,
      deepWorkMinutes: null,
      sleepHours: null,
      exerciseMinutes: null,
      readingMinutes: null,
      entertainmentMinutes: null,
      habitsScheduled: null,
      habitsCompleted: null,
    })
    expect(empty.score).toBeNull()
    expect(empty.componentsUsed).toBe(0)
  })

  it('spreads points that add up to the score', () => {
    const result = computeDayScore({ ...full, sleepHours: 5.5, entertainmentMinutes: 120 })
    const sum = result.components.reduce((total, component) => total + component.points, 0)
    expect(sum).toBeCloseTo(result.score ?? 0, 1)
  })

  it('respects custom weights', () => {
    const sleepOnly = computeDayScore(
      { ...full, sleepHours: 4 },
      { focus: 0, sleep: 100, exercise: 0, habits: 0, reading: 0, entertainment: 0 },
    )
    expect(sleepOnly.score).toBe(0)
  })
})

describe('computePeriodScore', () => {
  it('averages only logged days and reports coverage', () => {
    const result = computePeriodScore([80, null, 60, null, 100, null, null], 7, 3)
    expect(result.score).toBe(80)
    expect(result.daysLogged).toBe(3)
    expect(result.coverageMet).toBe(true)
  })

  it('withholds the number below the coverage floor', () => {
    const result = computePeriodScore([90, null, null, null, null, null, null], 7, 4)
    expect(result.score).toBeNull()
    expect(result.coverageMet).toBe(false)
    expect(result.daysLogged).toBe(1)
  })

  it('never treats a missing day as a zero', () => {
    const sparse = computePeriodScore([100, null, null, 100], 4, 2)
    expect(sparse.score).toBe(100)
  })
})

describe('weights', () => {
  it('validates that weights sum to 100', () => {
    expect(weightsAreValid(DEFAULT_SCORE_WEIGHTS)).toBe(true)
    expect(weightsAreValid({ ...DEFAULT_SCORE_WEIGHTS, focus: 40 })).toBe(false)
  })

  it('normalizes arbitrary weights back to 100', () => {
    const normalized = normalizeWeights({
      focus: 3,
      sleep: 2,
      exercise: 1,
      habits: 1,
      reading: 1,
      entertainment: 2,
    })
    const total = Object.values(normalized).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(100, 1)
  })
})
