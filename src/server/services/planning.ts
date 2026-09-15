import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { CalendarEvent, PlannedBlock } from '@/lib/db/schema'
import {
  addDays,
  eachDay,
  fromISODate,
  monthEndOf,
  monthStartOf,
  toISODate,
  today as todayOf,
  weekEndOf,
  weekStartOf,
  type DateRange,
  type ISODate,
} from '@/lib/dates'
import { monthGrid, monthsOfYear } from '@/lib/planning/month-grid'
import { toEventForm, type EventForm } from '@/lib/planning/event-form'
import { holidaysIn, type Holiday, type HolidayKey } from '@/lib/planning/holidays'
import { expandAll } from '@/lib/planning/recurrence'
import { findSessions } from '@/server/repositories/learning'
import { findEvents, findPlannedBlocks } from '@/server/repositories/planning'
import { dayContextOf, getSettings } from '@/server/services/settings'

/**
 * One dated instance of an event. A repeating event yields several, all sharing
 * the stored row's `id`, so `key` is what a list can be keyed and linked by.
 */
export type EventOccurrence = CalendarEvent & { key: string; series: EventForm }

export type PlanVsActualDay = {
  date: ISODate
  plannedMinutes: number
  actualMinutes: number
  blocks: PlannedBlock[]
}

export type PlanningData = {
  today: ISODate
  range: DateRange
  weekStart: ISODate
  events: EventOccurrence[]
  holidays: Holiday[]
  days: PlanVsActualDay[]
  totals: { planned: number; actual: number }
}

/**
 * Spec 14 — plan against actual is the view that earns this module: planned
 * blocks overlaid with the focus sessions that actually happened.
 */
export const getPlanningData = cache(async (weekOf?: ISODate): Promise<PlanningData> => {
  const settings = await getSettings()
  const userId = await getCurrentUserId()
  const today = todayOf(dayContextOf(settings))
  const weekStart = weekStartOf(weekOf ?? today, settings.weekStart)
  const range = { start: weekStart, end: weekEndOf(weekStart, settings.weekStart) }

  const window = { from: fromISODate(range.start), to: fromISODate(addDays(range.end, 1)) }

  const [eventRows, blocks, sessions] = await Promise.all([
    // The window is [start of the first day, start of the day after the last).
    findEvents(userId, window.from, window.to),
    findPlannedBlocks(userId, range),
    findSessions(userId, range, 500),
  ])

  const seriesById = new Map(eventRows.map((row) => [row.id, toEventForm(row)]))

  const days = eachDay(range).map((date) => {
    const dayBlocks = blocks.filter((block) => block.blockDate === date)
    const plannedMinutes = dayBlocks.reduce(
      (sum, block) => sum + minutesBetween(block.startTime, block.endTime),
      0,
    )
    const actualMinutes = sessions
      .filter((session) => session.sessionDate === date)
      .reduce((sum, session) => sum + session.minutes, 0)

    return { date, plannedMinutes, actualMinutes, blocks: dayBlocks }
  })

  return {
    today,
    range,
    weekStart,
    events: expandAll(eventRows, window).map((event) => ({
      ...event,
      key: `${event.id}:${toISODate(event.startsAt)}`,
      series: seriesById.get(event.id) ?? toEventForm(event),
    })),
    holidays: holidaysIn(range),
    days,
    totals: {
      planned: days.reduce((sum, day) => sum + day.plannedMinutes, 0),
      actual: days.reduce((sum, day) => sum + day.actualMinutes, 0),
    },
  }
})

/** One thing sitting on a date, from either source, ready to be listed. */
export type CalendarItem = {
  key: string
  date: ISODate
  /** The instant it starts, or null for an all-day event. */
  at: Date | null
  title: string | null
  kind: 'event' | 'block' | 'holiday'
  blockKind: PlannedBlock['kind'] | null
  /** Set on a holiday, whose name is translated rather than stored. */
  holidayKey: HolidayKey | null
  repeating: boolean
}

export type CalendarDay = {
  date: ISODate
  inMonth: boolean
  items: CalendarItem[]
}

export type MonthCalendar = {
  today: ISODate
  month: ISODate
  weeks: CalendarDay[][]
  count: number
}

/** Enough of a day to label it on hover; `count` still reports the whole day. */
export type YearDay = {
  date: ISODate
  inMonth: boolean
  count: number
  items: CalendarItem[]
}

export type YearCalendar = {
  today: ISODate
  year: number
  months: {
    month: ISODate
    weeks: YearDay[][]
    count: number
  }[]
  count: number
}

/** A hover card longer than this is unreadable anyway, so the rest is a count. */
const YEAR_HOVER_ITEMS = 4

/** The window covering a range of dates end to end, for the timestamp columns. */
const windowOf = (range: DateRange) => ({
  from: fromISODate(range.start),
  to: new Date(`${range.end}T23:59:59.999`),
})

async function collectItems(userId: string, range: DateRange): Promise<CalendarItem[]> {
  const window = windowOf(range)
  const [eventRows, blocks] = await Promise.all([
    findEvents(userId, window.from, window.to),
    findPlannedBlocks(userId, range),
  ])

  const items: CalendarItem[] = expandAll(eventRows, window).map((event) => ({
    key: `${event.id}:${toISODate(event.startsAt)}`,
    date: toISODate(event.startsAt),
    at: event.allDay ? null : event.startsAt,
    title: event.title,
    kind: 'event' as const,
    blockKind: null,
    holidayKey: null,
    repeating: event.recurrenceRule !== null,
  }))

  for (const block of blocks) {
    items.push({
      key: block.id,
      date: block.blockDate,
      at: new Date(`${block.blockDate}T${block.startTime}`),
      title: block.note,
      kind: 'block',
      blockKind: block.kind,
      holidayKey: null,
      repeating: false,
    })
  }

  for (const holiday of holidaysIn(range)) {
    items.push({
      key: `holiday:${holiday.key}:${holiday.date}`,
      date: holiday.date,
      at: null,
      title: null,
      kind: 'holiday',
      blockKind: null,
      holidayKey: holiday.key,
      repeating: false,
    })
  }

  // All-day first, then by clock time. A holiday heads its day — it is what the
  // day is — and an event comes before a block at the same minute.
  const rank = { holiday: 0, event: 1, block: 2 } as const

  return items.sort(
    (a, b) => (a.at?.getTime() ?? -1) - (b.at?.getTime() ?? -1) || rank[a.kind] - rank[b.kind],
  )
}

export const getMonthCalendar = cache(async (monthOf?: ISODate): Promise<MonthCalendar> => {
  const settings = await getSettings()
  const userId = await getCurrentUserId()
  const today = todayOf(dayContextOf(settings))
  const month = monthStartOf(monthOf ?? today)
  const weeks = monthGrid(month, settings.weekStart)

  const grid = weeks.flat()
  const items = await collectItems(userId, {
    start: grid[0] ?? month,
    end: grid[grid.length - 1] ?? monthEndOf(month),
  })

  const byDate = groupByDate(items)

  return {
    today,
    month,
    weeks: weeks.map((week) =>
      week.map((date) => ({
        date,
        inMonth: date.slice(0, 7) === month.slice(0, 7),
        items: byDate.get(date) ?? [],
      })),
    ),
    count: items.filter((item) => item.date.slice(0, 7) === month.slice(0, 7)).length,
  }
})

export const getYearCalendar = cache(async (yearOf?: number): Promise<YearCalendar> => {
  const settings = await getSettings()
  const userId = await getCurrentUserId()
  const today = todayOf(dayContextOf(settings))
  const year = yearOf ?? Number(today.slice(0, 4))

  const items = await collectItems(userId, { start: `${year}-01-01`, end: `${year}-12-31` })
  const byDate = groupByDate(items)

  const months = monthsOfYear(year).map((month) => {
    const weeks = monthGrid(month, settings.weekStart).map((week) =>
      week.map((date) => {
        const onThisDay = byDate.get(date) ?? []
        return {
          date,
          inMonth: date.slice(0, 7) === month.slice(0, 7),
          count: onThisDay.length,
          items: onThisDay.slice(0, YEAR_HOVER_ITEMS),
        }
      }),
    )
    return {
      month,
      weeks,
      count: items.filter((item) => item.date.slice(0, 7) === month.slice(0, 7)).length,
    }
  })

  return { today, year, months, count: items.length }
})

function groupByDate(items: CalendarItem[]): Map<ISODate, CalendarItem[]> {
  const byDate = new Map<ISODate, CalendarItem[]>()
  for (const item of items) {
    const day = byDate.get(item.date)
    if (day) day.push(item)
    else byDate.set(item.date, [item])
  }
  return byDate
}

function minutesBetween(start: string, end: string): number {
  const [startHour = 0, startMinute = 0] = start.split(':').map(Number)
  const [endHour = 0, endMinute = 0] = end.split(':').map(Number)
  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute))
}
