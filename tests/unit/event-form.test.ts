import { describe, expect, it } from 'vitest'
import { toEventForm, type EventRow } from '../../src/lib/planning/event-form'
import { expandOccurrences } from '../../src/lib/planning/recurrence'

const ZONE = 'Asia/Ho_Chi_Minh'

/** Instant that is `HH:mm` on that calendar day in Vietnam. */
const atVn = (isoLocal: string) => {
  // 09:30 VN = 02:30Z the same day.
  const [date, time = '00:00:00'] = isoLocal.split('T')
  const [h = 0, m = 0, s = 0] = time.split(':').map(Number)
  return new Date(Date.UTC(Number(date!.slice(0, 4)), Number(date!.slice(5, 7)) - 1, Number(date!.slice(8, 10)), h - 7, m, s))
}

const weekly: EventRow = {
  id: 'event-1',
  title: 'Họp team',
  startsAt: atVn('2026-09-01T09:30:00'),
  endsAt: atVn('2026-09-01T10:00:00'),
  allDay: false,
  location: 'Phòng 3',
  recurrenceRule: 'weekly',
  recurrenceUntil: '2026-12-31',
}

describe('toEventForm', () => {
  it('splits the stored instant into a date and wall-clock times in the user zone', () => {
    expect(toEventForm(weekly, ZONE)).toEqual({
      id: 'event-1',
      title: 'Họp team',
      date: '2026-09-01',
      startTime: '09:30',
      endTime: '10:00',
      allDay: false,
      location: 'Phòng 3',
      recurrenceRule: 'weekly',
      recurrenceUntil: '2026-12-31',
    })
  })

  it('leaves an all-day event without times', () => {
    const form = toEventForm(
      {
        ...weekly,
        allDay: true,
        startsAt: atVn('2026-09-01T00:00:00'),
        endsAt: null,
      },
      ZONE,
    )
    expect(form.startTime).toBeNull()
    expect(form.endTime).toBeNull()
  })

  it('leaves the end time off an event that has no end', () => {
    expect(toEventForm({ ...weekly, endsAt: null }, ZONE).endTime).toBeNull()
  })

  /*
   * The bug the whole type exists to stop: editing the fourth Tuesday of a
   * weekly series must not move the series to that Tuesday.
   */
  it('reports the series start, not the occurrence being looked at', () => {
    const occurrences = expandOccurrences(weekly, {
      from: atVn('2026-09-20T00:00:00'),
      to: atVn('2026-09-27T00:00:00'),
    })

    expect(occurrences).toHaveLength(1)
    expect(occurrences[0]?.startsAt.getUTCDate()).toBe(22)
    // The occurrence has moved; the row it came from has not.
    expect(toEventForm(weekly, ZONE).date).toBe('2026-09-01')
  })

  it('keeps a Vietnam evening meeting at 19:30 when the host is UTC', () => {
    // 19:30 VN = 12:30Z — the prod bug stored 19:30Z and showed 02:30.
    const evening: EventRow = {
      ...weekly,
      startsAt: new Date('2026-10-13T12:30:00.000Z'),
      endsAt: null,
      recurrenceRule: null,
      recurrenceUntil: null,
    }
    expect(toEventForm(evening, ZONE)).toMatchObject({
      date: '2026-10-13',
      startTime: '19:30',
    })
  })
})
