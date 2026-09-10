import { getCurrentUserId } from '@/lib/auth/current-user'
import { addDays, fromISODate, today as todayOf } from '@/lib/dates'
import { findEvents } from '@/server/repositories/planning'
import { dayContextOf, getSettings } from '@/server/services/settings'

/** One-way ICS export (spec 14): the data stays readable in any calendar app. */
export async function GET() {
  const settings = await getSettings()
  const today = todayOf(dayContextOf(settings))

  const events = await findEvents(
    await getCurrentUserId(),
    fromISODate(addDays(today, -365)),
    fromISODate(addDays(today, 365)),
  )

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Personal OS//EN',
    'CALSCALE:GREGORIAN',
    ...events.flatMap((event) => [
      'BEGIN:VEVENT',
      `UID:${event.id}@personal-os`,
      `DTSTAMP:${toIcsDate(event.createdAt)}`,
      event.allDay
        ? `DTSTART;VALUE=DATE:${toIcsDay(event.startsAt)}`
        : `DTSTART:${toIcsDate(event.startsAt)}`,
      ...(event.endsAt && !event.allDay ? [`DTEND:${toIcsDate(event.endsAt)}`] : []),
      `SUMMARY:${escapeIcs(event.title)}`,
      ...(event.location ? [`LOCATION:${escapeIcs(event.location)}`] : []),
      ...(event.note ? [`DESCRIPTION:${escapeIcs(event.note)}`] : []),
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ]

  return new Response(lines.join('\r\n'), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="personal-os.ics"',
      'cache-control': 'no-store',
    },
  })
}

const toIcsDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
const toIcsDay = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, '')
const escapeIcs = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
