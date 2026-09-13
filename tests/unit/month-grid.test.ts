import { describe, expect, it } from 'vitest'
import { monthGrid, monthsOfYear } from '@/lib/planning/month-grid'

describe('monthGrid', () => {
  it('returns whole weeks', () => {
    for (const weeks of [monthGrid('2026-09-01', 'monday'), monthGrid('2026-02-15', 'sunday')]) {
      expect(weeks.every((week) => week.length === 7)).toBe(true)
    }
  })

  it('starts the row on the configured first day of the week', () => {
    // 1 September 2026 is a Tuesday.
    expect(monthGrid('2026-09-01', 'monday')[0]?.[0]).toBe('2026-08-31')
    expect(monthGrid('2026-09-01', 'sunday')[0]?.[0]).toBe('2026-08-30')
  })

  it('covers every day of the month', () => {
    const flat = monthGrid('2026-02-01', 'monday').flat()
    expect(flat).toContain('2026-02-01')
    expect(flat).toContain('2026-02-28')
    expect(flat).not.toContain('2026-02-29')
  })

  it('spills no further than one week either side', () => {
    const flat = monthGrid('2026-09-01', 'monday').flat()
    expect(flat.filter((date) => date.startsWith('2026-08')).length).toBeLessThan(7)
    expect(flat.filter((date) => date.startsWith('2026-10')).length).toBeLessThan(7)
  })

  it('needs six rows for a 31-day month that opens on the last weekday', () => {
    // 1 August 2026 is a Saturday, so a Monday-start grid runs into a sixth row.
    expect(monthGrid('2026-08-01', 'monday')).toHaveLength(6)
  })

  it('takes any date in the month, not just the first', () => {
    expect(monthGrid('2026-09-30', 'monday')).toEqual(monthGrid('2026-09-01', 'monday'))
  })
})

describe('monthsOfYear', () => {
  it('lists the twelve firsts', () => {
    const months = monthsOfYear(2026)
    expect(months).toHaveLength(12)
    expect(months[0]).toBe('2026-01-01')
    expect(months[11]).toBe('2026-12-01')
  })
})
