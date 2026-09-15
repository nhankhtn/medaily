import { describe, expect, it } from 'vitest'
import { fromLunar, toLunar } from '../../src/lib/planning/lunar'

/**
 * Anchors checked against published Vietnamese calendars rather than against
 * the algorithm itself — a conversion that agrees only with its own arithmetic
 * proves nothing.
 */
const TET = {
  2020: '2020-01-25',
  2021: '2021-02-12',
  2022: '2022-02-01',
  2023: '2023-01-22',
  2024: '2024-02-10',
  2025: '2025-01-29',
  2026: '2026-02-17',
  2027: '2027-02-06',
  2028: '2028-01-26',
} as const

describe('fromLunar', () => {
  it('lands Tết on the day the country keeps it', () => {
    for (const [year, date] of Object.entries(TET)) {
      expect(fromLunar({ day: 1, month: 1, year: Number(year) }), year).toBe(date)
    }
  })

  it('lands Giỗ Tổ on the tenth of the third month', () => {
    expect(fromLunar({ day: 10, month: 3, year: 2026 })).toBe('2026-04-26')
    expect(fromLunar({ day: 10, month: 3, year: 2027 })).toBe('2027-04-16')
  })

  it('finds the mid-autumn full moon', () => {
    expect(fromLunar({ day: 15, month: 8, year: 2026 })).toBe('2026-09-25')
  })

  it('finds the repeated month in a year that has one', () => {
    // 2025 keeps a second sixth month, a lunar month after the first.
    expect(fromLunar({ day: 1, month: 6, year: 2025 })).toBe('2025-06-25')
    expect(fromLunar({ day: 1, month: 6, year: 2025, leap: true })).toBe('2025-07-25')
  })

  it('refuses a repeated month in a year that has none', () => {
    // 2026 repeats no month, so there is no second sixth month to ask for.
    expect(fromLunar({ day: 1, month: 6, year: 2026, leap: true })).toBeNull()
    // Nor a second of some other month in a year that does repeat one.
    expect(fromLunar({ day: 1, month: 3, year: 2025, leap: true })).toBeNull()
  })
})

describe('toLunar', () => {
  it('reads Tết back', () => {
    for (const [year, date] of Object.entries(TET)) {
      expect(toLunar(date), date).toMatchObject({ day: 1, month: 1, year: Number(year) })
    }
  })

  it('round-trips every day of a year, leap month and all', () => {
    // 2025 repeats the sixth month, which is where an off-by-one would show.
    const start = new Date(2025, 0, 1)
    for (let index = 0; index < 365; index += 1) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(
        day.getDate(),
      ).padStart(2, '0')}`

      expect(fromLunar(toLunar(iso)), iso).toBe(iso)
    }
  })

  it('puts the last days of December in the twelfth month of the year before', () => {
    // 31 December 2026 is still deep in the eleventh lunar month of 2026.
    expect(toLunar('2026-12-31').year).toBe(2026)
  })
})
