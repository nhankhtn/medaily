import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import vi from '../../messages/vi.json'
import { FORMATS, formatDate, formatDayMonth } from '@/lib/format/dates'

describe('numeric dates', () => {
  it('are day first, in both locales', () => {
    expect(formatDate('2026-09-14')).toBe('14/09/2026')
    expect(formatDayMonth('2026-09-14')).toBe('14/09')
  })

  it('keep the leading zero, so the columns line up', () => {
    expect(formatDate('2026-01-05')).toBe('05/01/2026')
    expect(formatDayMonth('2026-01-05')).toBe('05/01')
  })

  it('does not go through Intl, which would reorder these under `en`', () => {
    const intlEn = new Intl.DateTimeFormat('en', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date('2026-09-14T12:00:00Z'))

    expect(intlEn).toBe('09/14/2026')
    expect(formatDate('2026-09-14')).not.toBe(intlEn)
  })
})

describe('the shared format names', () => {
  it('spell a wordy date the way each language does', () => {
    const date = new Date('2026-09-14T09:30:07Z')
    const render = (locale: string, name: keyof typeof FORMATS.dateTime) =>
      new Intl.DateTimeFormat(locale, {
        timeZone: 'UTC',
        ...FORMATS.dateTime[name],
      }).format(date)

    // A month name carries its own order per language, and that is correct in
    // both. Only the all-numeric date is pinned — see formatDate.
    expect(render('vi', 'dayMonth')).toBe('14 thg 9')
    expect(render('vi', 'dayMonthYear')).toBe('14 thg 9, 2026')
    expect(render('en', 'dayMonth')).toBe('Sep 14')
    expect(render('en', 'clock')).toBe('09:30:07')
    expect(render('vi', 'clock')).toBe('09:30:07')
  })

  it('never asks for a twelve-hour clock', () => {
    // `=== true` is a comparison the types rule out, and `!options.hour12`
    // catches the formats that correctly ask for a 24-hour clock. What the
    // test means is: nothing sets it to anything other than false.
    const twelveHour = Object.values(FORMATS.dateTime).filter(
      (options) => 'hour12' in options && options.hour12 !== false,
    )
    expect(twelveHour).toEqual([])
  })

  it('is the only place a date format is written', () => {
    // Every locale file is checked for date wording that belongs in FORMATS.
    for (const messages of [en, vi]) {
      const text = JSON.stringify(messages)
      expect(text).not.toMatch(/dd\/mm|mm\/dd|yyyy-mm-dd/i)
    }
  })
})
