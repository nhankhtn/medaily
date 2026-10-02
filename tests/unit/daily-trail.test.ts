import { describe, expect, it } from 'vitest'
import { loggingStreak } from '@/lib/daily/trail'

const TODAY = '2026-01-10'

/** Logged dates from a compact string ending today: x = logged, . = not. */
function logged(pattern: string): Set<string> {
  const out = new Set<string>()
  pattern.split('').forEach((char, index) => {
    if (char === 'x') out.add(`2026-01-${String(index + 11 - pattern.length).padStart(2, '0')}`)
  })
  return out
}

const run = (pattern: string, graceEnabled = true) =>
  loggingStreak({ logged: logged(pattern), start: '2026-01-01', today: TODAY, graceEnabled })

describe('loggingStreak', () => {
  it('draws an unlogged today as pending, not missed', () => {
    const result = run('xxxxxxxxx.')
    expect(result.current).toBe(9)
    expect(result.pendingToday).toBe(true)
    expect(result.trail.at(-1)).toEqual({ date: TODAY, state: 'pending' })
  })

  it('draws the day the grace rule held as frozen', () => {
    const result = run('xxxxxxx.xx')
    expect(result.frozen).toBe(true)
    expect(result.trail.map((day) => day.state)).toEqual([
      'logged',
      'logged',
      'logged',
      'logged',
      'frozen',
      'logged',
      'logged',
    ])
  })

  it('draws a miss as missed once the streak broke there', () => {
    const result = run('xxxxxx..xx')
    expect(result.current).toBe(2)
    expect(result.trail.slice(3, 5).map((day) => day.state)).toEqual(['missed', 'missed'])
  })

  it('never freezes in strict mode', () => {
    const result = run('xxxxxxx.xx', false)
    expect(result.current).toBe(2)
    expect(result.trail[4]?.state).toBe('missed')
  })

  it('has one entry per day, ending today', () => {
    const result = run('..........')
    expect(result.trail).toHaveLength(7)
    expect(result.trail[0]?.date).toBe('2026-01-04')
    expect(result.current).toBe(0)
  })
})
