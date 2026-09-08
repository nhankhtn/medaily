import { describe, expect, it } from 'vitest'
import { computeStreak, statusFor, type StreakDay } from '@/lib/streaks'

const thresholds = { studyMinutes: 30, deepWorkMinutes: 60, readingMinutes: 10 }

/** Builds an oldest → newest series from a compact string: h=hit m=miss p=pending n=not scheduled */
function series(pattern: string): StreakDay[] {
  return pattern.split('').map((char, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, '0')}`,
    status:
      char === 'h' ? 'hit' : char === 'm' ? 'miss' : char === 'p' ? 'pending' : 'not_scheduled',
  }))
}

describe('computeStreak', () => {
  it('counts an unbroken run', () => {
    const result = computeStreak(series('hhhhh'))
    expect(result.current).toBe(5)
    expect(result.best).toBe(5)
    expect(result.frozen).toBe(false)
  })

  it('does not break on an unlogged today', () => {
    const result = computeStreak(series('hhhhp'))
    expect(result.current).toBe(4)
    expect(result.pendingToday).toBe(true)
  })

  it('holds the streak through a single miss (grace day)', () => {
    const result = computeStreak(series('hhhmh'))
    expect(result.current).toBe(4)
    expect(result.frozen).toBe(true)
  })

  it('breaks on two consecutive misses', () => {
    const result = computeStreak(series('hhhhmmh'))
    expect(result.current).toBe(1)
    expect(result.best).toBe(4)
  })

  it('breaks when a second miss falls inside the same 7-day window', () => {
    // Two misses three days apart: the newer one is frozen, the older one
    // breaks the streak — so only the hits back to that point survive.
    const result = computeStreak(series('hhhmhhmh'))
    expect(result.current).toBe(3)
    expect(result.frozen).toBe(true)
  })

  it('forgives a second miss once the window has passed', () => {
    const result = computeStreak(series('hmhhhhhhhmhh'))
    expect(result.current).toBeGreaterThanOrEqual(9)
  })

  it('breaks on any miss in strict mode', () => {
    const result = computeStreak(series('hhhmh'), false)
    expect(result.current).toBe(1)
    expect(result.frozen).toBe(false)
  })

  it('ignores days the habit was not scheduled', () => {
    const result = computeStreak(series('hnnhnnh'))
    expect(result.current).toBe(3)
    expect(result.best).toBe(3)
  })

  it('reports the best streak from history after a break', () => {
    const result = computeStreak(series('hhhhhhmmhh'))
    expect(result.current).toBe(2)
    expect(result.best).toBe(6)
  })

  it('handles an empty series', () => {
    const result = computeStreak([])
    expect(result.current).toBe(0)
    expect(result.best).toBe(0)
    expect(result.startedOn).toBeNull()
  })
})

describe('statusFor', () => {
  const day = {
    date: '2026-09-07',
    logged: true,
    studyMinutes: 45,
    deepWorkMinutes: 90,
    exerciseMinutes: 0,
    readingMinutes: 5,
  }

  it('treats an unlogged past day as a miss and an unlogged today as pending', () => {
    const unlogged = { ...day, logged: false }
    expect(statusFor('logging', unlogged, thresholds, false)).toBe('miss')
    expect(statusFor('logging', unlogged, thresholds, true)).toBe('pending')
  })

  it('applies the metric thresholds', () => {
    expect(statusFor('study', day, thresholds, false)).toBe('hit')
    expect(statusFor('deep_work', day, thresholds, false)).toBe('hit')
    expect(statusFor('exercise', day, thresholds, false)).toBe('miss')
    expect(statusFor('reading', day, thresholds, false)).toBe('miss')
  })

  it('keeps a logged-but-short today open rather than counting it against the user', () => {
    expect(statusFor('reading', day, thresholds, true)).toBe('pending')
  })
})
