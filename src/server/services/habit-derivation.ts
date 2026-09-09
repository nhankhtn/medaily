import { and, asc, eq, gte } from 'drizzle-orm'
import type { DbOrTx } from '@/lib/db'
import { dailyEffective, dailyLogs } from '@/lib/db/schema'
import type { Habit } from '@/lib/db/schema'
import { evaluateLink, isScheduledOn } from '@/lib/habits/schedule'
import type { ISODate } from '@/lib/dates'
import {
  deleteHabitLog,
  findHabitsActiveOn,
  upsertHabitLog,
} from '@/server/repositories/habits'

/**
 * Values a metric-linked habit can bind to. Study and deep work use the
 * session-resolved numbers so a habit agrees with what the dashboard shows.
 */
export type MetricSnapshot = Record<string, number | null>

export async function loadMetricSnapshot(
  tx: DbOrTx,
  userId: string,
  date: ISODate,
): Promise<MetricSnapshot | null> {
  const rows = await tx
    .select()
    .from(dailyEffective)
    .where(and(eq(dailyEffective.userId, userId), eq(dailyEffective.logDate, date)))
    .limit(1)
  const row = rows[0]
  if (!row) return null

  const study = row.effectiveStudyMinutes
  const deep = row.effectiveDeepWorkMinutes

  return {
    energy: row.energy,
    mood: row.mood,
    sleep_hours: row.sleepHours === null ? null : Number(row.sleepHours),
    technical_study_minutes: study,
    deep_work_minutes: deep,
    focus_minutes: study === null && deep === null ? null : (study ?? 0) + (deep ?? 0),
    exercise_minutes: row.exerciseMinutes,
    reading_minutes: row.readingMinutes,
    reading_pages: row.readingPages,
    entertainment_minutes: row.entertainmentMinutes,
    english_minutes: row.englishMinutes,
  }
}

/**
 * Spec 7.3 — a habit bound to a metric completes itself from the daily log, in
 * the same transaction as the log write, so the two can never disagree and the
 * user never enters the same fact twice.
 *
 * Derived rows are removed (not set to false) when the condition no longer
 * holds, keeping "not done" indistinguishable from "never ticked" for
 * completion-rate maths.
 */
export async function recomputeDerivedHabitLogs(
  tx: DbOrTx,
  userId: string,
  date: ISODate,
  weekStart: 'monday' | 'sunday',
): Promise<{ updated: number }> {
  const snapshot = await loadMetricSnapshot(tx, userId, date)
  const active = await findHabitsActiveOn(userId, date, tx)
  const linked = active.filter(
    (habit): habit is Habit & { linkedMetric: string } => habit.linkedMetric !== null,
  )

  let updated = 0

  for (const habit of linked) {
    const scheduled = isScheduledOn(
      {
        frequencyType: habit.frequencyType,
        targetCount: habit.targetCount,
        weekdays: habit.weekdays ?? null,
        intervalDays: habit.intervalDays ?? null,
        startDate: habit.startDate,
        endDate: habit.endDate,
      },
      date,
    )

    const value = snapshot?.[habit.linkedMetric] ?? null
    const met =
      scheduled &&
      habit.linkedOperator !== null &&
      habit.linkedThreshold !== null &&
      evaluateLink(habit.linkedOperator, Number(habit.linkedThreshold), value)

    if (met) {
      await upsertHabitLog(
        {
          userId,
          habitId: habit.id,
          logDate: date,
          count: habit.targetCount,
          completed: true,
          source: 'derived',
        },
        tx,
      )
    } else {
      await deleteHabitLog(habit.id, date, userId, tx)
    }
    updated += 1
  }

  // `weekStart` is accepted for symmetry with weekly habits, whose period
  // completion is evaluated at read time from the same derived day rows.
  void weekStart
  return { updated }
}


/** How far back a newly created or re-bound habit will catch up. */
export const BACKFILL_DAYS = 400

/**
 * Recomputes derived habit logs for every day already recorded from `from`
 * onwards.
 *
 * Without this, creating "sleep 7h+" today leaves last week untouched and the
 * habit looks broken — the user entered the sleep, the rule matches, and
 * nothing ticked (spec 7.3: a binding change recomputes its history).
 *
 * Only dates that actually have a daily log are visited: days with nothing
 * recorded have nothing to derive from.
 */
export async function backfillDerivedHabitLogs(
  tx: DbOrTx,
  userId: string,
  from: ISODate,
  weekStart: 'monday' | 'sunday',
): Promise<{ days: number }> {
  const rows = await tx
    .select({ logDate: dailyLogs.logDate })
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), gte(dailyLogs.logDate, from)))
    .orderBy(asc(dailyLogs.logDate))
    .limit(BACKFILL_DAYS)

  for (const row of rows) {
    await recomputeDerivedHabitLogs(tx, userId, row.logDate, weekStart)
  }

  return { days: rows.length }
}
