import { describe, expect, it } from 'vitest'
import { toEventForm, type EventRow } from '../../src/lib/planning/event-form'
import { expandOccurrences } from '../../src/lib/planning/recurrence'

const at = (iso: string) => new Date(iso)

const weekly: EventRow = {
  id: 'event-1',
  title: 'Họp team',
  startsAt: at('2026-09-01T09:30:00'),
  endsAt: at('2026-09-01T10:00:00'),
  allDay: false,
  location: 'Phòng 3',
  recurrenceRule: 'weekly',
  recurrenceUntil: '2026-12-31',
}

describe('toEventForm', () => {
  it('splits the stored instant into a date and wall-clock times', () => {
    expect(toEventForm(weekly)).toEqual({
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
    const form = toEventForm({
      ...weekly,
      allDay: true,
      startsAt: at('2026-09-01T00:00:00'),
      endsAt: null,
    })
    expect(form.startTime).toBeNull()
    expect(form.endTime).toBeNull()
  })

  it('leaves the end time off an event that has no end', () => {
    expect(toEventForm({ ...weekly, endsAt: null }).endTime).toBeNull()
  })

  /*
   * The bug the whole type exists to stop: editing the fourth Tuesday of a
   * weekly series must not move the series to that Tuesday.
   */
  it('reports the series start, not the occurrence being looked at', () => {
    const occurrences = expandOccurrences(weekly, {
      from: at('2026-09-20T00:00:00'),
      to: at('2026-09-27T00:00:00'),
    })

    expect(occurrences).toHaveLength(1)
    expect(occurrences[0]?.startsAt.getDate()).toBe(22)
    // The occurrence has moved; the row it came from has not.
    expect(toEventForm(weekly).date).toBe('2026-09-01')
  })
})
