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
import { expandAll } from '@/lib/planning/recurrence'
import { findSessions } from '@/server/repositories/learning'
import { findEvents, findPlannedBlocks } from '@/server/repositories/planning'
import { dayContextOf, getSettings } from '@/server/services/settings'

/**
 * One dated instance of an event. A repeating event yields several, all sharing
 * the stored row's `id`, so `key` is what a list can be keyed and linked by.
 */
export type EventOccurrence = CalendarEvent & { key: string }

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

  const days = eachDay(range).map((date) => {
    const dayBlocks = blocks.filter((block) => block.blockDate === date)
    const plannedMinutes = dayBlocks.reduce((sum, block) => sum + minutesBetween(block.startTime, block.endTime), 0)
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
    })),
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
  kind: 'event' | 'block'
  blockKind: PlannedBlock['kind'] | null
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

export type YearCalendar = {
  today: ISODate
  year: number
  months: { month: ISODate; weeks: { date: ISODate; inMonth: boolean; count: number }[][]; count: number }[]
  count: number
}

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
      repeating: false,
    })
  }

  // All-day first, then by clock time; events before blocks at the same minute.
  return items.sort(
    (a, b) =>
      (a.at?.getTime() ?? -1) - (b.at?.getTime() ?? -1) || a.kind.localeCompare(b.kind),
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
  const countOf = (date: ISODate) => byDate.get(date)?.length ?? 0

  const months = monthsOfYear(year).map((month) => {
    const weeks = monthGrid(month, settings.weekStart).map((week) =>
      week.map((date) => ({
        date,
        inMonth: date.slice(0, 7) === month.slice(0, 7),
        count: countOf(date),
      })),
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
