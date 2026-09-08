import { db } from '@/lib/db'
import type { DailyLog } from '@/lib/db/schema'
import { addDays, rangeOfLastDays, today, type ISODate } from '@/lib/dates'
import type { DailyLogPatchInput } from '@/lib/validation/daily'
import { recomputeDerivedHabitLogs } from '@/server/services/habit-derivation'
import { dayContextOf, getSettings } from '@/server/services/settings'
import {
  deleteLog,
  findEffectiveLog,
  findEffectiveRange,
  findExerciseTypes,
  findLatestLogBefore,
  findMedians,
  findRawLog,
  upsertLog,
  type DailyLogPatch,
} from '@/server/repositories/daily'

export class FutureDateError extends Error {
  constructor(readonly date: ISODate) {
    super(`cannot log a future date: ${date}`)
    this.name = 'FutureDateError'
  }
}

/** Drizzle stores `numeric` as string; the form speaks numbers. */
function toDbPatch(patch: DailyLogPatchInput): DailyLogPatch {
  const { sleepHours, ...rest } = patch
  return {
    ...rest,
    ...(sleepHours === undefined ? {} : { sleepHours: sleepHours === null ? null : String(sleepHours) }),
  }
}

export type SaveResult = {
  saved: DailyLog
  /** Row as it was before the write, so the client can offer a real undo. */
  previous: DailyLog | null
}

/**
 * The daily write path. One transaction covers the log row and every habit that
 * derives from it (spec 7.3, 26.1), so a failure leaves neither half applied.
 */
export async function saveDailyLog(
  date: ISODate,
  patch: DailyLogPatchInput,
  source: 'manual' | 'catch_up' | 'import' = 'manual',
): Promise<SaveResult> {
  const settings = await getSettings()
  const logicalToday = today(dayContextOf(settings))
  if (date > logicalToday) throw new FutureDateError(date)

  return db.transaction(async (tx) => {
    const previous = await findRawLog(settings.userId, date)
    const saved = await upsertLog(settings.userId, date, { ...toDbPatch(patch), source }, tx)
    await recomputeDerivedHabitLogs(tx, settings.userId, date, settings.weekStart)
    return { saved, previous }
  })
}

export async function saveManyDailyLogs(
  rows: { date: ISODate; patch: DailyLogPatchInput }[],
): Promise<number> {
  const settings = await getSettings()
  const logicalToday = today(dayContextOf(settings))
  const future = rows.find((row) => row.date > logicalToday)
  if (future) throw new FutureDateError(future.date)

  return db.transaction(async (tx) => {
    for (const row of rows) {
      await upsertLog(settings.userId, row.date, { ...toDbPatch(row.patch), source: 'catch_up' }, tx)
      await recomputeDerivedHabitLogs(tx, settings.userId, row.date, settings.weekStart)
    }
    return rows.length
  })
}

export async function removeDailyLog(date: ISODate): Promise<void> {
  const settings = await getSettings()
  await deleteLog(settings.userId, date)
}

export type DailyFormData = {
  date: ISODate
  today: ISODate
  log: DailyLog | null
  effective: Awaited<ReturnType<typeof findEffectiveLog>>
  medians: Awaited<ReturnType<typeof findMedians>>
  exerciseTypes: string[]
  previousDay: DailyLog | null
  /** Unlogged days in the recent past, for the catch-up banner (spec 6.4). */
  missingDays: ISODate[]
}

export async function getDailyFormData(date: ISODate): Promise<DailyFormData> {
  const settings = await getSettings()
  const logicalToday = today(dayContextOf(settings))
  const medianSince = addDays(logicalToday, -13)

  const [log, effective, medians, exerciseTypes, previousDay, missingDays] = await Promise.all([
    findRawLog(settings.userId, date),
    findEffectiveLog(settings.userId, date),
    findMedians(settings.userId, medianSince),
    findExerciseTypes(settings.userId),
    findLatestLogBefore(settings.userId, date),
    findMissingDays(logicalToday, 7),
  ])

  return {
    date,
    today: logicalToday,
    log,
    effective,
    medians,
    exerciseTypes,
    previousDay,
    missingDays,
  }
}

/** Unlogged days inside the last `days` days, excluding today. */
export async function findMissingDays(endDate: ISODate, days: number): Promise<ISODate[]> {
  const settings = await getSettings()
  const range = rangeOfLastDays(addDays(endDate, -1), days)
  const logs = await findEffectiveRange(settings.userId, range)
  const logged = new Set(logs.map((log) => log.logDate))

  const missing: ISODate[] = []
  let cursor = range.start
  while (cursor <= range.end) {
    if (!logged.has(cursor)) missing.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return missing
}

export async function getPreviousDayValues(date: ISODate): Promise<{
  date: ISODate
  patch: DailyLogPatchInput
} | null> {
  const settings = await getSettings()
  const previous = await findLatestLogBefore(settings.userId, date)
  if (!previous) return null

  return {
    date: previous.logDate,
    patch: {
      energy: previous.energy,
      mood: previous.mood,
      sleepHours: previous.sleepHours === null ? null : Number(previous.sleepHours),
      technicalStudyMinutes: previous.technicalStudyMinutes,
      deepWorkMinutes: previous.deepWorkMinutes,
      exerciseMinutes: previous.exerciseMinutes,
      exerciseType: previous.exerciseType,
      readingMinutes: previous.readingMinutes,
      readingPages: previous.readingPages,
      entertainmentMinutes: previous.entertainmentMinutes,
      englishMinutes: previous.englishMinutes,
    },
  }
}
