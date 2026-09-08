import { cache } from 'react'
import { addDays, eachDay, monthStartOf, rangeOfLastDays, today as todayOf, weekEndOf, weekStartOf, type ISODate } from '@/lib/dates'
import { computeCompletion, isScheduledOn, type HabitSchedule } from '@/lib/habits/schedule'
import { computeStreak } from '@/lib/streaks'
import { findHabitLogsInRange, findHabits } from '@/server/repositories/habits'
import { dayContextOf, getSettings } from '@/server/services/settings'

const GRID_DAYS = 28
const HISTORY_DAYS = 180

export type HabitView = {
  id: string
  name: string
  category: string
  frequencyType: HabitSchedule['frequencyType']
  targetCount: number
  linkedMetric: string | null
  linkedOperator: string | null
  linkedThreshold: number | null
  scheduledToday: boolean
  completedToday: boolean
  currentStreak: number
  bestStreak: number
  frozen: boolean
  monthlyRate: number | null
  weekCompleted: number
  /** Newest last, for the 28-day grid. */
  grid: { date: ISODate; status: 'hit' | 'miss' | 'pending' | 'not_scheduled' }[]
}

export const getHabitsView = cache(async (): Promise<{ today: ISODate; habits: HabitView[] }> => {
  const settings = await getSettings()
  const today = todayOf(dayContextOf(settings))
  const historyRange = rangeOfLastDays(today, HISTORY_DAYS)

  const [rows, logs] = await Promise.all([
    findHabits(settings.userId),
    findHabitLogsInRange(settings.userId, historyRange),
  ])

  const counts = new Map<string, Map<ISODate, number>>()
  for (const log of logs) {
    const perHabit = counts.get(log.habitId) ?? new Map<ISODate, number>()
    perHabit.set(log.logDate, (perHabit.get(log.logDate) ?? 0) + log.count)
    counts.set(log.habitId, perHabit)
  }

  const monthRange = { start: monthStartOf(today), end: today }
  const weekRange = {
    start: weekStartOf(today, settings.weekStart),
    end: weekEndOf(today, settings.weekStart),
  }

  const habits = rows.map((row): HabitView => {
    const schedule: HabitSchedule = {
      frequencyType: row.frequencyType,
      targetCount: row.targetCount,
      weekdays: row.weekdays ?? null,
      intervalDays: row.intervalDays ?? null,
      startDate: row.startDate,
      endDate: row.endDate,
    }
    const perHabit = counts.get(row.id) ?? new Map<ISODate, number>()

    // Weekly habits are streaked over weeks; everything else over days.
    const streakDays =
      row.frequencyType === 'weekly'
        ? weeksOf(historyRange.start, today, settings.weekStart).map((week) => {
            const done = eachDay({ start: week, end: addDays(week, 6) }).reduce(
              (sum, date) => sum + (perHabit.get(date) ?? 0),
              0,
            )
            const isCurrent = week === weekRange.start
            return {
              date: week,
              status:
                done >= row.targetCount
                  ? ('hit' as const)
                  : isCurrent
                    ? ('pending' as const)
                    : ('miss' as const),
            }
          })
        : eachDay(historyRange).map((date) => ({
            date,
            status: !isScheduledOn(schedule, date)
              ? ('not_scheduled' as const)
              : (perHabit.get(date) ?? 0) >= row.targetCount
                ? ('hit' as const)
                : date === today
                  ? ('pending' as const)
                  : ('miss' as const),
          }))

    const streak = computeStreak(streakDays, settings.streakGraceEnabled)
    const completion = computeCompletion(schedule, monthRange, perHabit, settings.weekStart)
    const weekCompleted = eachDay(weekRange).reduce(
      (sum, date) => sum + (perHabit.get(date) ?? 0),
      0,
    )

    return {
      id: row.id,
      name: row.name,
      category: row.category,
      frequencyType: row.frequencyType,
      targetCount: row.targetCount,
      linkedMetric: row.linkedMetric,
      linkedOperator: row.linkedOperator,
      linkedThreshold: row.linkedThreshold === null ? null : Number(row.linkedThreshold),
      scheduledToday: isScheduledOn(schedule, today),
      completedToday: (perHabit.get(today) ?? 0) >= row.targetCount,
      currentStreak: streak.current,
      bestStreak: streak.best,
      frozen: streak.frozen,
      monthlyRate: completion.rate,
      weekCompleted,
      grid: streakDays.slice(-GRID_DAYS),
    }
  })

  return { today, habits }
})

function weeksOf(start: ISODate, end: ISODate, weekStart: 'monday' | 'sunday'): ISODate[] {
  const out: ISODate[] = []
  let cursor = weekStartOf(start, weekStart)
  while (cursor <= end) {
    out.push(cursor)
    cursor = addDays(cursor, 7)
  }
  return out
}
