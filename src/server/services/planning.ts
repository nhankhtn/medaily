import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { CalendarEvent, PlannedBlock } from '@/lib/db/schema'
import {
  addDays,
  eachDay,
  monthEndOf,
  monthStartOf,
  startOfZonedDay,
  toISODateInZone,
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
import { findProjects, findTasksInRange } from '@/server/repositories/projects'
import type { DayTask } from '@/server/services/day-plan'
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
  /** Due that day, finished or not — the week has to show what it is for. */
  tasks: DayTask[]
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
  const { timezone } = settings

  const window = {
    from: startOfZonedDay(range.start, timezone),
    to: startOfZonedDay(addDays(range.end, 1), timezone),
  }

  const [eventRows, blocks, sessions, tasks, projects] = await Promise.all([
    // The window is [start of the first day, start of the day after the last).
    findEvents(userId, window.from, window.to),
    findPlannedBlocks(userId, range),
    findSessions(userId, range, 500),
    findTasksInRange(userId, range),
    findProjects(userId),
  ])

  const projectNameOf = new Map(projects.map((project) => [project.id, project.name]))
  const asDayTask = (task: (typeof tasks)[number]): DayTask => ({
    ...task,
    projectName: task.projectId ? (projectNameOf.get(task.projectId) ?? null) : null,
    // Late as of now, not as of the day it sits on.
    overdue: task.status !== 'done' && task.dueDate !== null && task.dueDate < today,
  })

  const seriesById = new Map(eventRows.map((row) => [row.id, toEventForm(row, timezone)]))

  const days = eachDay(range).map((date) => {
    const dayBlocks = blocks.filter((block) => block.blockDate === date)
    const plannedMinutes = dayBlocks.reduce(
      (sum, block) => sum + minutesBetween(block.startTime, block.endTime),
      0,
    )
    const actualMinutes = sessions
      .filter((session) => session.sessionDate === date)
      .reduce((sum, session) => sum + session.minutes, 0)

    return {
      date,
      plannedMinutes,
      actualMinutes,
      blocks: dayBlocks,
      tasks: tasks.filter((task) => task.dueDate === date).map(asDayTask),
    }
  })

  return {
    today,
    range,
    weekStart,
    events: expandAll(eventRows, window).map((event) => ({
      ...event,
      key: `${event.id}:${toISODateInZone(event.startsAt, timezone)}`,
      series: seriesById.get(event.id) ?? toEventForm(event, timezone),
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
  kind: 'event' | 'block' | 'holiday' | 'task'
  blockKind: PlannedBlock['kind'] | null
  /** Set on a holiday, whose name is translated rather than stored. */
  holidayKey: HolidayKey | null
  repeating: boolean
  /** Only a task can be finished; everything else is `false`. */
  done: boolean
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
const windowOf = (range: DateRange, timezone: string) => ({
  from: startOfZonedDay(range.start, timezone),
  to: startOfZonedDay(addDays(range.end, 1), timezone),
})

async function collectItems(
  userId: string,
  range: DateRange,
  timezone: string,
): Promise<CalendarItem[]> {
  const window = windowOf(range, timezone)
  const [eventRows, blocks, tasks] = await Promise.all([
    findEvents(userId, window.from, window.to),
    findPlannedBlocks(userId, range),
    findTasksInRange(userId, range),
  ])

  const items: CalendarItem[] = expandAll(eventRows, window).map((event) => ({
    key: `${event.id}:${toISODateInZone(event.startsAt, timezone)}`,
    date: toISODateInZone(event.startsAt, timezone),
    at: event.allDay ? null : event.startsAt,
    title: event.title,
    kind: 'event' as const,
    blockKind: null,
    holidayKey: null,
    repeating: event.recurrenceRule !== null,
    done: false,
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
      done: false,
    })
  }

  for (const task of tasks) {
    if (!task.dueDate) continue
    items.push({
      key: `task:${task.id}`,
      date: task.dueDate,
      // A task is owed on a day, not at a time, so it sits with the all-day row.
      at: null,
      title: task.title,
      kind: 'task',
      blockKind: null,
      holidayKey: null,
      repeating: false,
      done: task.status === 'done',
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
      done: false,
    })
  }

  // All-day first, then by clock time. A holiday heads its day — it is what
  // the day is — then what you owe the day, then what is booked into it.
  const rank = { holiday: 0, task: 1, event: 2, block: 3 } as const

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
  const items = await collectItems(
    userId,
    {
      start: grid[0] ?? month,
      end: grid[grid.length - 1] ?? monthEndOf(month),
    },
    settings.timezone,
  )

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

  const items = await collectItems(
    userId,
    { start: `${year}-01-01`, end: `${year}-12-31` },
    settings.timezone,
  )
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
