import { describe, expect, it } from 'vitest'
import { parsePeriodPhrase } from '../../src/lib/reviews/period-phrase'

/** A Sunday, so the Monday/Sunday week start actually differs. */
const TODAY = '2026-09-13'

const parse = (text: string, weekStart: 'monday' | 'sunday' = 'monday') =>
  parsePeriodPhrase(text, TODAY, weekStart)

describe('parsePeriodPhrase', () => {
  it('defaults to the current week', () => {
    expect(parse('tôi thế nào')).toEqual({ period: 'weekly', key: '2026-09-07' })
  })

  it('honours the week start', () => {
    expect(parse('tuần này', 'monday').key).toBe('2026-09-07')
    expect(parse('tuần này', 'sunday').key).toBe('2026-09-13')
  })

  it('reads Vietnamese week phrases, with or without tones', () => {
    for (const phrase of ['tuần trước', 'tuan truoc', 'tuần rồi', 'tuần qua', 'last week']) {
      expect(parse(phrase), phrase).toEqual({ period: 'weekly', key: '2026-08-31' })
    }
  })

  it('reads month phrases', () => {
    expect(parse('tháng này')).toEqual({ period: 'monthly', key: '2026-09-01' })
    expect(parse('tháng trước')).toEqual({ period: 'monthly', key: '2026-08-01' })
    expect(parse('last month')).toEqual({ period: 'monthly', key: '2026-08-01' })
  })

  it('prefers the longer phrase, so "trước nữa" is not eaten by "trước"', () => {
    expect(parse('tuần trước nữa').key).toBe('2026-08-24')
    expect(parse('tháng trước nữa').key).toBe('2026-07-01')
  })

  it('reads a month by number', () => {
    expect(parse('tháng 7')).toEqual({ period: 'monthly', key: '2026-07-01' })
    expect(parse('tháng 09')).toEqual({ period: 'monthly', key: '2026-09-01' })
  })

  it('reads a future month as last year, not the future', () => {
    // December has not happened in September, so "tháng 12" is the one behind.
    expect(parse('tháng 12')).toEqual({ period: 'monthly', key: '2025-12-01' })
  })

  it('ignores a month number that is not one', () => {
    expect(parse('tháng 13').period).toBe('monthly')
    expect(parse('tháng 13').key).toBe('2026-09-01')
  })

  it('falls back to this month when a message says month but names none', () => {
    expect(parse('cả tháng thì sao')).toEqual({ period: 'monthly', key: '2026-09-01' })
  })

  it('takes a month phrase over a week one when both appear', () => {
    expect(parse('so tháng này với tuần này').period).toBe('monthly')
  })
})
