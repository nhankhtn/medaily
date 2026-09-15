import { describe, expect, it } from 'vitest'
import { holidaysIn, holidaysOn, HOLIDAY_KEYS } from '../../src/lib/planning/holidays'

const on = (date: string) => holidaysOn(date).map((holiday) => holiday.key)

describe('holidaysOn', () => {
  it('knows the fixed days', () => {
    expect(on('2026-01-01')).toEqual(['newYear'])
    expect(on('2026-04-30')).toEqual(['reunification'])
    expect(on('2026-09-02')).toEqual(['nationalDay'])
    expect(on('2026-11-20')).toEqual(['teachersDay'])
    expect(on('2026-11-24')).toEqual(['cultureDay'])
  })

  it('follows Tết as it moves', () => {
    // 2026 opens on 17 February, 2027 on 6 February.
    expect(on('2026-02-16')).toEqual(['tetEve'])
    expect(on('2026-02-17')).toEqual(['tet1'])
    expect(on('2026-02-19')).toEqual(['tet3'])
    expect(on('2027-02-06')).toEqual(['tet1'])
  })

  it('follows the other lunar days', () => {
    expect(on('2026-04-26')).toEqual(['hungKings'])
    expect(on('2026-09-25')).toEqual(['midAutumn'])
  })

  it('says nothing about an ordinary day', () => {
    expect(on('2026-09-15')).toEqual([])
  })
})

describe('holidaysIn', () => {
  it('returns a window in order', () => {
    const week = holidaysIn({ start: '2026-02-16', end: '2026-02-22' })
    expect(week.map((holiday) => holiday.date)).toEqual([
      '2026-02-16',
      '2026-02-17',
      '2026-02-18',
      '2026-02-19',
    ])
    expect(week.every((holiday) => holiday.off)).toBe(true)
  })

  /*
   * The reason the search runs a year either side: these fall in a solar year
   * that is not the lunar year they belong to.
   */
  it('catches a lunar day that drifted across the new year', () => {
    // The kitchen gods of lunar 2025 — the twelfth month — land in solar 2026.
    expect(on('2026-02-10')).toEqual(['kitchenGods'])
    // And new year's eve of lunar 2028 lands in solar 2028, but eve of 2029
    // would be in 2029; check the boundary of a January window all the same.
    expect(holidaysIn({ start: '2026-01-01', end: '2026-01-31' }).map((h) => h.key)).toEqual([
      'newYear',
    ])
  })

  it('marks which days are days off', () => {
    const year = holidaysIn({ start: '2026-01-01', end: '2026-12-31' })
    const off = year.filter((holiday) => holiday.off).map((holiday) => holiday.key)
    expect(off).toEqual([
      'newYear',
      'tetEve',
      'tet1',
      'tet2',
      'tet3',
      'hungKings',
      'reunification',
      'labour',
      'nationalDay',
      'cultureDay',
    ])
  })

  /*
   * Ngày Văn hóa Việt Nam was voted in during 2026. The year view reaches back,
   * and a holiday nobody took should not appear in a year before it existed.
   */
  it('does not backdate a holiday to before it was introduced', () => {
    expect(on('2025-11-24')).toEqual([])
    expect(on('2024-11-24')).toEqual([])
    expect(on('2027-11-24')).toEqual(['cultureDay'])
  })

  it('finds every rule at least once across a year', () => {
    const found = new Set(
      holidaysIn({ start: '2026-01-01', end: '2026-12-31' }).map((holiday) => holiday.key),
    )
    expect([...HOLIDAY_KEYS].filter((key) => !found.has(key))).toEqual([])
  })
})
