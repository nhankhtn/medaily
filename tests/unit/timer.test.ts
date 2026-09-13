import { describe, expect, it } from 'vitest'
import {
  elapsedSeconds,
  formatDuration,
  isPaused,
  minutesOf,
  pausedRun,
  remainingSeconds,
  resumedRun,
  wasCapped,
  type TimerRun,
} from '@/lib/timer'

const at = (iso: string) => new Date(iso)
const run = (over: Partial<TimerRun> = {}): TimerRun => ({
  startedAt: at('2026-09-13T09:00:00Z'),
  pausedAt: null,
  accumulatedSeconds: 0,
  ...over,
})

describe('elapsedSeconds', () => {
  it('counts from the start of the current stretch', () => {
    expect(elapsedSeconds(run(), at('2026-09-13T09:05:30Z'))).toBe(330)
  })

  it('adds what earlier stretches banked', () => {
    expect(elapsedSeconds(run({ accumulatedSeconds: 600 }), at('2026-09-13T09:05:00Z'))).toBe(900)
  })

  it('stands still while paused', () => {
    const paused = run({ pausedAt: at('2026-09-13T09:05:00Z'), accumulatedSeconds: 300 })
    expect(elapsedSeconds(paused, at('2026-09-13T09:05:00Z'))).toBe(300)
    expect(elapsedSeconds(paused, at('2026-09-13T11:00:00Z'))).toBe(300)
  })

  it('never goes negative when the clock is behind the start', () => {
    expect(elapsedSeconds(run(), at('2026-09-13T08:59:00Z'))).toBe(0)
  })
})

describe('pause and resume', () => {
  it('banks the running stretch on pause', () => {
    const paused = pausedRun(run(), at('2026-09-13T09:10:00Z'))
    expect(paused.accumulatedSeconds).toBe(600)
    expect(isPaused(paused)).toBe(true)
  })

  it('does nothing to an already paused run', () => {
    const already = run({ pausedAt: at('2026-09-13T09:05:00Z'), accumulatedSeconds: 300 })
    expect(pausedRun(already, at('2026-09-13T10:00:00Z'))).toEqual(already)
  })

  it('restarts the stretch from now on resume, keeping the bank', () => {
    const resumed = resumedRun(
      run({ pausedAt: at('2026-09-13T09:05:00Z'), accumulatedSeconds: 300 }),
      at('2026-09-13T10:00:00Z'),
    )
    expect(resumed.accumulatedSeconds).toBe(300)
    expect(resumed.startedAt).toEqual(at('2026-09-13T10:00:00Z'))
    expect(isPaused(resumed)).toBe(false)
  })

  it('does not count the paused stretch after resuming', () => {
    const paused = pausedRun(run(), at('2026-09-13T09:10:00Z'))
    const resumed = resumedRun(paused, at('2026-09-13T09:40:00Z'))
    // Ten minutes worked, thirty minutes away, one more minute worked.
    expect(elapsedSeconds(resumed, at('2026-09-13T09:41:00Z'))).toBe(660)
  })

  it('survives several rounds', () => {
    let current = run()
    current = pausedRun(current, at('2026-09-13T09:05:00Z'))
    current = resumedRun(current, at('2026-09-13T09:20:00Z'))
    current = pausedRun(current, at('2026-09-13T09:25:00Z'))
    current = resumedRun(current, at('2026-09-13T10:00:00Z'))
    expect(elapsedSeconds(current, at('2026-09-13T10:01:00Z'))).toBe(11 * 60)
  })

  it('leaves a running run alone on resume', () => {
    const going = run({ accumulatedSeconds: 60 })
    expect(resumedRun(going, at('2026-09-13T10:00:00Z'))).toEqual(going)
  })
})

describe('remainingSeconds', () => {
  it('counts down towards the target', () => {
    expect(remainingSeconds(run(), 25 * 60, at('2026-09-13T09:05:00Z'))).toBe(20 * 60)
  })

  it('goes negative on an overrun', () => {
    expect(remainingSeconds(run(), 25 * 60, at('2026-09-13T09:30:00Z'))).toBe(-5 * 60)
  })
})

describe('minutesOf', () => {
  it('rounds to the nearest minute', () => {
    expect(minutesOf(89)).toBe(1)
    expect(minutesOf(91)).toBe(2)
  })

  it('caps a run left going all day', () => {
    expect(minutesOf(20 * 3600)).toBe(8 * 60)
    expect(wasCapped(20 * 3600)).toBe(true)
    expect(wasCapped(3600)).toBe(false)
  })

  it('reports nothing for a run barely started', () => {
    expect(minutesOf(20)).toBe(0)
  })
})

describe('formatDuration', () => {
  it('drops the hour until there is one', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(65)).toBe('01:05')
    expect(formatDuration(3600)).toBe('1:00:00')
    expect(formatDuration(3725)).toBe('1:02:05')
  })

  it('marks an overrun with a sign', () => {
    expect(formatDuration(-65)).toBe('-01:05')
  })
})
