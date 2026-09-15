import { toISODate, type ISODate } from '@/lib/dates'
import type { RecurrenceRule } from '@/lib/planning/recurrence'

/**
 * The stored row as the edit form wants it: one date and wall-clock times,
 * rather than the instants an occurrence carries.
 *
 * It exists because a repeating event is expanded into copies whose `startsAt`
 * has already moved to their own day. Handing one of those to the form would
 * move the whole series to that day the moment it was saved — so the form is
 * always built from the row, never from the occurrence.
 */
export type EventForm = {
  id: string
  title: string
  date: ISODate
  startTime: string | null
  endTime: string | null
  allDay: boolean
  location: string | null
  recurrenceRule: RecurrenceRule | null
  recurrenceUntil: ISODate | null
}

/** The stored row, as much of it as the form needs. */
export type EventRow = {
  id: string
  title: string
  startsAt: Date
  endsAt: Date | null
  allDay: boolean
  location: string | null
  recurrenceRule: RecurrenceRule | null
  recurrenceUntil: ISODate | null
}

const hhmm = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

export function toEventForm(row: EventRow): EventForm {
  return {
    id: row.id,
    title: row.title,
    date: toISODate(row.startsAt),
    // An all-day event is stored at midnight; showing 00:00 would invite
    // someone to un-tick the box and save a meeting nobody scheduled.
    startTime: row.allDay ? null : hhmm(row.startsAt),
    endTime: row.allDay || !row.endsAt ? null : hhmm(row.endsAt),
    allDay: row.allDay,
    location: row.location,
    recurrenceRule: row.recurrenceRule,
    recurrenceUntil: row.recurrenceUntil,
  }
}
