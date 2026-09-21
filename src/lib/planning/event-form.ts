import { hhmmInZone, toISODateInZone, type ISODate } from '@/lib/dates'
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

/**
 * Split a stored instant into the date and `HH:mm` the form shows.
 *
 * Must use the user's timezone: `Date#getHours()` is the server's clock, which
 * on a UTC host turns a 19:30 Vietnam meeting into 12:30 in the edit dialog.
 */
export function toEventForm(row: EventRow, timezone: string): EventForm {
  return {
    id: row.id,
    title: row.title,
    date: toISODateInZone(row.startsAt, timezone),
    // An all-day event is stored at midnight in the user's zone; showing 00:00
    // would invite someone to un-tick the box and save a meeting nobody scheduled.
    startTime: row.allDay ? null : hhmmInZone(row.startsAt, timezone),
    endTime: row.allDay || !row.endsAt ? null : hhmmInZone(row.endsAt, timezone),
    allDay: row.allDay,
    location: row.location,
    recurrenceRule: row.recurrenceRule,
    recurrenceUntil: row.recurrenceUntil,
  }
}
