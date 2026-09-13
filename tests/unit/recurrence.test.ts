import { describe, expect, it } from 'vitest'
import { expandAll, expandOccurrences, toRrule, type Recurring } from '@/lib/planning/recurrence'

const at = (iso: string) => new Date(iso)

const event = (over: Partial<Recurring> = {}): Recurring => ({
  startsAt: at('2026-01-05T09:00:00'),
  endsAt: at('2026-01-05T10:00:00'),
  recurrenceRule: null,
  recurrenceUntil: null,
  ...over,
})

const days = (list: Recurring[]) =>
  list.map((item) => item.startsAt.toISOString().slice(0, 10))

describe('events that do not repeat', () => {
  it('appears when it falls inside the window', () => {
    const found = expandOccurrences(event(), {
      from: at('2026-01-01T00:00:00'),
      to: at('2026-01-31T23:59:59'),
    })
    expect(days(found)).toEqual(['2026-01-05'])
  })

  it('is absent from other windows', () => {
    const found = expandOccurrences(event(), {
      from: at('2026-02-01T00:00:00'),
      to: at('2026-02-28T23:59:59'),
    })
    expect(found).toEqual([])
  })
})

describe('repeating', () => {
  const window = { from: at('2026-03-01T00:00:00'), to: at('2026-03-31T23:59:59') }

  it('weekly lands on the same weekday', () => {
    const found = expandOccurrences(event({ recurrenceRule: 'weekly' }), window)
    expect(days(found)).toEqual(['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23', '2026-03-30'])
  })

  it('daily fills the window', () => {
    const found = expandOccurrences(event({ recurrenceRule: 'daily' }), window)
    expect(found).toHaveLength(31)
  })

  it('monthly keeps the day of the month', () => {
    const found = expandOccurrences(event({ recurrenceRule: 'monthly' }), {
      from: at('2026-01-01T00:00:00'),
      to: at('2026-06-30T23:59:59'),
    })
    expect(days(found)).toEqual([
      '2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05', '2026-05-05', '2026-06-05',
    ])
  })

  it('quarterly steps three months', () => {
    const found = expandOccurrences(event({ recurrenceRule: 'quarterly' }), {
      from: at('2026-01-01T00:00:00'),
      to: at('2026-12-31T23:59:59'),
    })
    expect(days(found)).toEqual(['2026-01-05', '2026-04-05', '2026-07-05', '2026-10-05'])
  })

  it('yearly returns on the same date', () => {
    const found = expandOccurrences(event({ recurrenceRule: 'yearly' }), {
      from: at('2029-01-01T00:00:00'),
      to: at('2029-12-31T23:59:59'),
    })
    expect(days(found)).toEqual(['2029-01-05'])
  })

  it('keeps the time of day and the duration', () => {
    const [occurrence] = expandOccurrences(event({ recurrenceRule: 'weekly' }), window)
    expect(occurrence?.startsAt.getHours()).toBe(9)
    expect((occurrence?.endsAt as Date).getTime() - (occurrence?.startsAt as Date).getTime()).toBe(
      60 * 60 * 1000,
    )
  })

  it('carries a null end through', () => {
    const [occurrence] = expandOccurrences(
      event({ recurrenceRule: 'weekly', endsAt: null }),
      window,
    )
    expect(occurrence?.endsAt).toBeNull()
  })
})

describe('months and years that lack the day', () => {
  it('skips months without a 31st rather than sliding into the next one', () => {
    const found = expandOccurrences(
      event({ startsAt: at('2026-01-31T09:00:00'), endsAt: null, recurrenceRule: 'monthly' }),
      { from: at('2026-01-01T00:00:00'), to: at('2026-05-31T23:59:59') },
    )
    // February, April and June have no 31st.
    expect(days(found)).toEqual(['2026-01-31', '2026-03-31', '2026-05-31'])
  })

  it('returns a 29 February event only in leap years', () => {
    const found = expandOccurrences(
      event({ startsAt: at('2028-02-29T09:00:00'), endsAt: null, recurrenceRule: 'yearly' }),
      { from: at('2028-01-01T00:00:00'), to: at('2033-12-31T23:59:59') },
    )
    expect(days(found)).toEqual(['2028-02-29', '2032-02-29'])
  })
})

describe('the until date', () => {
  it('stops the series after it', () => {
    const found = expandOccurrences(
      event({ recurrenceRule: 'weekly', recurrenceUntil: '2026-01-20' }),
      { from: at('2026-01-01T00:00:00'), to: at('2026-02-28T23:59:59') },
    )
    expect(days(found)).toEqual(['2026-01-05', '2026-01-12', '2026-01-19'])
  })

  it('includes an occurrence falling on the until date itself', () => {
    const found = expandOccurrences(
      event({ recurrenceRule: 'weekly', recurrenceUntil: '2026-01-19' }),
      { from: at('2026-01-01T00:00:00'), to: at('2026-02-28T23:59:59') },
    )
    expect(days(found)).toContain('2026-01-19')
  })
})

describe('expandAll', () => {
  it('merges series and sorts by time', () => {
    const found = expandAll(
      [
        event({ startsAt: at('2026-03-10T15:00:00'), endsAt: null }),
        event({ startsAt: at('2026-01-05T09:00:00'), endsAt: null, recurrenceRule: 'weekly' }),
      ],
      { from: at('2026-03-01T00:00:00'), to: at('2026-03-16T23:59:59') },
    )
    expect(days(found)).toEqual(['2026-03-02', '2026-03-09', '2026-03-10', '2026-03-16'])
  })

  it('does not run away on a long window', () => {
    const found = expandOccurrences(event({ recurrenceRule: 'daily', endsAt: null }), {
      from: at('2026-01-01T00:00:00'),
      to: at('2036-12-31T23:59:59'),
    })
    expect(found.length).toBeLessThanOrEqual(750)
  })
})

describe('toRrule', () => {
  it('maps each rule to an RFC 5545 frequency', () => {
    expect(toRrule('daily', null)).toBe('RRULE:FREQ=DAILY')
    expect(toRrule('weekly', null)).toBe('RRULE:FREQ=WEEKLY')
    expect(toRrule('monthly', null)).toBe('RRULE:FREQ=MONTHLY')
    expect(toRrule('yearly', null)).toBe('RRULE:FREQ=YEARLY')
  })

  it('expresses quarterly as every third month', () => {
    expect(toRrule('quarterly', null)).toBe('RRULE:FREQ=MONTHLY;INTERVAL=3')
  })

  it('appends the until date', () => {
    expect(toRrule('weekly', '2026-06-30')).toBe('RRULE:FREQ=WEEKLY;UNTIL=20260630T235959Z')
  })

  it('uses a bare date for an all-day series, to match its DTSTART', () => {
    expect(toRrule('weekly', '2026-06-30', true)).toBe('RRULE:FREQ=WEEKLY;UNTIL=20260630')
  })
})

describe('a series that began long before the window', () => {
  const window = { from: at('2026-03-01T00:00:00'), to: at('2026-03-31T23:59:59') }

  it('still shows a daily series from ten years back', () => {
    const found = expandOccurrences(
      event({ startsAt: at('2016-01-05T09:00:00'), endsAt: null, recurrenceRule: 'daily' }),
      window,
    )
    expect(found).toHaveLength(31)
    expect(days(found)[0]).toBe('2026-03-01')
  })

  it('still shows a weekly series from ten years back', () => {
    const found = expandOccurrences(
      event({ startsAt: at('2016-01-05T09:00:00'), endsAt: null, recurrenceRule: 'weekly' }),
      window,
    )
    // 5 January 2016 was a Tuesday.
    expect(days(found)).toEqual(['2026-03-03', '2026-03-10', '2026-03-17', '2026-03-24', '2026-03-31'])
  })

  it('still shows a monthly series from ten years back', () => {
    const found = expandOccurrences(
      event({ startsAt: at('2016-03-05T09:00:00'), endsAt: null, recurrenceRule: 'monthly' }),
      window,
    )
    expect(days(found)).toEqual(['2026-03-05'])
  })

  it('still shows a yearly series from ten years back', () => {
    const found = expandOccurrences(
      event({ startsAt: at('2016-03-05T09:00:00'), endsAt: null, recurrenceRule: 'yearly' }),
      window,
    )
    expect(days(found)).toEqual(['2026-03-05'])
  })

  it('still shows a quarterly series from ten years back', () => {
    const found = expandOccurrences(
      event({ startsAt: at('2016-03-05T09:00:00'), endsAt: null, recurrenceRule: 'quarterly' }),
      window,
    )
    expect(days(found)).toEqual(['2026-03-05'])
  })

  it('has ended when the until date is in the past', () => {
    const found = expandOccurrences(
      event({
        startsAt: at('2016-01-05T09:00:00'),
        endsAt: null,
        recurrenceRule: 'weekly',
        recurrenceUntil: '2016-03-01',
      }),
      window,
    )
    expect(found).toEqual([])
  })
})
