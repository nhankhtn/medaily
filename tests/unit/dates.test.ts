import { describe, expect, it } from 'vitest'
import {
  addDays,
  compareDates,
  diffDays,
  eachDay,
  isBeforeRollover,
  isISODate,
  isoWeekday,
  logicalDateOf,
  monthEndOf,
  monthStartOf,
  previousRange,
  rangeOfLastDays,
  today,
  weekEndOf,
  weekStartOf,
  type DayContext,
} from '@/lib/dates'

const saigon: DayContext = {
  timezone: 'Asia/Ho_Chi_Minh',
  dayRolloverHour: 4,
  weekStart: 'monday',
}

describe('logicalDateOf', () => {
  it('files a 1 a.m. entry under the previous day', () => {
    // 2026-09-08T01:30 in Saigon is 2026-09-07T18:30Z.
    const instant = new Date('2026-09-07T18:30:00Z')
    expect(logicalDateOf(instant, saigon)).toBe('2026-09-07')
    expect(isBeforeRollover(saigon, instant)).toBe(true)
  })

  it('files an entry after the rollover under the current day', () => {
    const instant = new Date('2026-09-07T23:00:00Z') // 06:00 local on the 8th
    expect(logicalDateOf(instant, saigon)).toBe('2026-09-08')
    expect(isBeforeRollover(saigon, instant)).toBe(false)
  })

  it('honours a zero rollover hour', () => {
    const midnightMode = { ...saigon, dayRolloverHour: 0 }
    const instant = new Date('2026-09-07T18:30:00Z') // 01:30 local on the 8th
    expect(logicalDateOf(instant, midnightMode)).toBe('2026-09-08')
  })

  it('resolves the same instant differently across timezones', () => {
    const instant = new Date('2026-09-07T18:30:00Z')
    expect(logicalDateOf(instant, { ...saigon, timezone: 'UTC' })).toBe('2026-09-07')
    expect(logicalDateOf(instant, { ...saigon, timezone: 'America/Los_Angeles' })).toBe('2026-09-07')
    expect(today(saigon, instant)).toBe('2026-09-07')
  })

  it('handles a DST-shifting timezone at the boundary', () => {
    const dst: DayContext = { ...saigon, timezone: 'Europe/Berlin' }
    // 2026-03-29 02:30 Berlin does not exist; 00:30Z is 01:30 CET → before rollover.
    expect(logicalDateOf(new Date('2026-03-29T00:30:00Z'), dst)).toBe('2026-03-28')
    expect(logicalDateOf(new Date('2026-03-29T08:00:00Z'), dst)).toBe('2026-03-29')
  })
})

describe('calendar arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01')
    expect(monthEndOf('2028-02-10')).toBe('2028-02-29')
    expect(monthEndOf('2026-02-10')).toBe('2026-02-28')
    expect(diffDays('2029-01-01', '2028-01-01')).toBe(366)
  })

  it('computes week bounds for both week starts', () => {
    // 2026-09-07 is a Monday.
    expect(weekStartOf('2026-09-07', 'monday')).toBe('2026-09-07')
    expect(weekEndOf('2026-09-07', 'monday')).toBe('2026-09-13')
    expect(weekStartOf('2026-09-07', 'sunday')).toBe('2026-09-06')
    expect(weekStartOf('2026-09-06', 'monday')).toBe('2026-08-31')
  })

  it('computes ISO weekdays with Sunday as 7', () => {
    expect(isoWeekday('2026-09-07')).toBe(1)
    expect(isoWeekday('2026-09-13')).toBe(7)
  })

  it('computes month bounds', () => {
    expect(monthStartOf('2026-09-07')).toBe('2026-09-01')
    expect(monthEndOf('2026-09-07')).toBe('2026-09-30')
  })
})

describe('ranges', () => {
  it('builds an inclusive list of dates', () => {
    expect(eachDay({ start: '2026-09-01', end: '2026-09-03' })).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ])
  })

  it('returns nothing for a reversed range instead of looping forever', () => {
    expect(eachDay({ start: '2026-09-03', end: '2026-09-01' })).toEqual([])
  })

  it('builds trailing windows and their predecessors', () => {
    const range = rangeOfLastDays('2026-09-07', 7)
    expect(range).toEqual({ start: '2026-09-01', end: '2026-09-07' })
    expect(previousRange(range)).toEqual({ start: '2026-08-25', end: '2026-08-31' })
  })

  it('validates ISO dates strictly', () => {
    expect(isISODate('2026-09-07')).toBe(true)
    expect(isISODate('2026-9-7')).toBe(false)
    expect(isISODate('2026-02-30')).toBe(false)
    expect(isISODate('not-a-date')).toBe(false)
    expect(compareDates('2026-01-01', '2026-01-02')).toBe(-1)
  })
})
