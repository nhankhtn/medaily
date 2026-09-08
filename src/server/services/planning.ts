import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { CalendarEvent, PlannedBlock } from '@/lib/db/schema'
import {
  addDays,
  eachDay,
  fromISODate,
  today as todayOf,
  weekEndOf,
  weekStartOf,
  type DateRange,
  type ISODate,
} from '@/lib/dates'
import { findSessions } from '@/server/repositories/learning'
import { findEvents, findPlannedBlocks } from '@/server/repositories/planning'
import { dayContextOf, getSettings } from '@/server/services/settings'

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
  events: CalendarEvent[]
  days: PlanVsActualDay[]
  totals: { planned: number; actual: number }
}

/**
 * Spec 14 — plan against actual is the view that earns this module: planned
 * blocks overlaid with the focus sessions that actually happened.
 */
export const getPlanningData = cache(async (weekOf?: ISODate): Promise<PlanningData> => {
  const settings = await getSettings()
  const userId = getCurrentUserId()
  const today = todayOf(dayContextOf(settings))
  const weekStart = weekStartOf(weekOf ?? today, settings.weekStart)
  const range = { start: weekStart, end: weekEndOf(weekStart, settings.weekStart) }

  const [eventRows, blocks, sessions] = await Promise.all([
    // The window is [start of the first day, start of the day after the last).
    findEvents(userId, fromISODate(range.start), fromISODate(addDays(range.end, 1))),
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
    events: eventRows,
    days,
    totals: {
      planned: days.reduce((sum, day) => sum + day.plannedMinutes, 0),
      actual: days.reduce((sum, day) => sum + day.actualMinutes, 0),
    },
  }
})

function minutesBetween(start: string, end: string): number {
  const [startHour = 0, startMinute = 0] = start.split(':').map(Number)
  const [endHour = 0, endMinute = 0] = end.split(':').map(Number)
  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute))
}
