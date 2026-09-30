import { describe, expect, it } from 'vitest'
import { asMonth } from '@/server/services/budgets'

/**
 * The month comes out of the address, so it is untrusted input rather than a
 * value. Anything that is not a month has to become "the one running now"
 * before it reaches the date helpers, which would otherwise do arithmetic on
 * it quite happily and return a page about nothing.
 */
describe('asMonth', () => {
  it('reads the short form the address carries', () => {
    expect(asMonth('2026-09')).toBe('2026-09-01')
  })

  it('reads a whole date as the month it falls in', () => {
    expect(asMonth('2026-09-17')).toBe('2026-09-01')
    expect(asMonth('2026-09-01')).toBe('2026-09-01')
  })

  it('keeps the padding, so the string sorts and compares', () => {
    expect(asMonth('2026-01')).toBe('2026-01-01')
    expect(asMonth('2026-12')).toBe('2026-12-01')
  })

  it('ignores space around it', () => {
    expect(asMonth('  2026-09  ')).toBe('2026-09-01')
  })

  it('refuses a month number that is not one', () => {
    for (const period of ['2026-00', '2026-13', '2026-99']) {
      expect(asMonth(period), period).toBeNull()
    }
  })

  it('refuses anything that is not a month at all', () => {
    for (const period of ['', '2026', 'september', '26-09', '2026/09', '2026-9', null, undefined]) {
      expect(asMonth(period), String(period)).toBeNull()
    }
  })
})
