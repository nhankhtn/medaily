import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { dailyLogs } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import type { DailyMinutesColumn } from '@/lib/timer/activities'
import { findCustomValues, saveCustomValues } from '@/server/repositories/custom-metrics'
import { upsertLog } from '@/server/repositories/daily'
import { recomputeDerivedHabitLogs } from '@/server/services/habit-derivation'

/** The column's own check constraint; a longer total would be rejected. */
const MAX_MINUTES_PER_DAY = 1440

/**
 * Adds a timed stretch onto a daily-log column.
 *
 * Adds rather than replaces: two sittings of reading in one day are 40 minutes,
 * not the second 20. Habits bound to the metric are recomputed in the same
 * transaction, so timing a stretch ticks the same box typing it would.
 */
export async function addDailyMinutes(values: {
  userId: string
  date: ISODate
  column: DailyMinutesColumn
  minutes: number
  weekStart: 'monday' | 'sunday'
}): Promise<number> {
  const { userId, date, column, minutes, weekStart } = values

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(dailyLogs)
      .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.logDate, date)))
      .limit(1)

    const existing = rows[0]?.[column] ?? 0
    const total = Math.min(MAX_MINUTES_PER_DAY, existing + minutes)

    await upsertLog(userId, date, { [column]: total }, tx)
    await recomputeDerivedHabitLogs(tx, userId, date, weekStart)
    return total
  })
}

/**
 * The same, for a metric the user invented. It lives in a row rather than a
 * column, so the day's log has to exist first — `upsertLog` with nothing to
 * patch creates it, which is what makes timing an activity on a blank day work.
 */
export async function addCustomMinutes(values: {
  userId: string
  date: ISODate
  metricId: string
  minutes: number
  weekStart: 'monday' | 'sunday'
}): Promise<number> {
  const { userId, date, metricId, minutes, weekStart } = values

  return db.transaction(async (tx) => {
    const log = await upsertLog(userId, date, {}, tx)
    const rows = await findCustomValues(log.id, tx)
    const existing = Number(rows.find((row) => row.customMetricId === metricId)?.valueNumeric ?? 0)
    const total = Math.min(MAX_MINUTES_PER_DAY, existing + minutes)

    await saveCustomValues(log.id, { [metricId]: total }, tx)
    await recomputeDerivedHabitLogs(tx, userId, date, weekStart)
    return total
  })
}
