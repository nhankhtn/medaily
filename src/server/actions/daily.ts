'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  bulkSaveDailyLogsSchema,
  dailyLogPatchSchema,
  exceedsDayBudget,
  isoDateSchema,
  saveDailyLogSchema,
} from '@/lib/validation/daily'
import {
  FutureDateError,
  getPreviousDayValues,
  removeDailyLog,
  saveDailyLog,
  saveManyDailyLogs,
} from '@/server/services/daily'

/** Every action revalidates the surfaces a daily write can change. */
function revalidateDaily(date: string) {
  revalidatePath('/')
  revalidatePath('/daily')
  revalidatePath(`/daily/${date}`)
  revalidatePath('/habits')
  revalidatePath('/goals')
  revalidatePath('/analytics')
}

export type SaveDayResult =
  | {
      ok: true
      /** Values as they were before this save, for the undo toast (spec 6.3). */
      previous: z.infer<typeof dailyLogPatchSchema> | null
      existedBefore: boolean
      warning: 'day_budget' | null
    }
  | { ok: false; error: 'future_date' | 'invalid_input' }

export async function saveDay(input: unknown): Promise<SaveDayResult> {
  const parsed = saveDailyLogSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const { date, patch, source } = parsed.data

  try {
    const result = await saveDailyLog(date, patch, source)
    revalidateDaily(date)

    return {
      ok: true,
      existedBefore: result.previous !== null,
      previous: result.previous
        ? {
            energy: result.previous.energy,
            mood: result.previous.mood,
            sleepHours:
              result.previous.sleepHours === null ? null : Number(result.previous.sleepHours),
            bedtime: result.previous.bedtime,
            wakeTime: result.previous.wakeTime,
            technicalStudyMinutes: result.previous.technicalStudyMinutes,
            deepWorkMinutes: result.previous.deepWorkMinutes,
            exerciseMinutes: result.previous.exerciseMinutes,
            exerciseType: result.previous.exerciseType,
            readingMinutes: result.previous.readingMinutes,
            readingPages: result.previous.readingPages,
            entertainmentMinutes: result.previous.entertainmentMinutes,
            englishMinutes: result.previous.englishMinutes,
            dailyWin: result.previous.dailyWin,
            dailyProblem: result.previous.dailyProblem,
            tomorrowPriority: result.previous.tomorrowPriority,
            note: result.previous.note,
          }
        : null,
      warning: exceedsDayBudget(patch) ? 'day_budget' : null,
    }
  } catch (error) {
    if (error instanceof FutureDateError) return { ok: false, error: 'future_date' }
    throw error
  }
}

/**
 * Undo restores the previous row, or removes the row entirely when the save had
 * created it — an undo that leaves a half-empty row behind is not an undo.
 */
export async function undoSaveDay(input: unknown): Promise<{ ok: boolean }> {
  const schema = z.object({
    date: isoDateSchema,
    previous: dailyLogPatchSchema.nullable(),
  })
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { ok: false }

  const { date, previous } = parsed.data
  if (previous === null) {
    await removeDailyLog(date)
  } else {
    await saveDailyLog(date, previous)
  }
  revalidateDaily(date)
  return { ok: true }
}

export async function deleteDay(input: unknown): Promise<{ ok: boolean }> {
  const date = isoDateSchema.parse(input)
  await removeDailyLog(date)
  revalidateDaily(date)
  return { ok: true }
}

export async function copyPreviousDay(input: unknown) {
  const date = isoDateSchema.parse(input)
  return getPreviousDayValues(date)
}

export async function saveCatchUp(input: unknown): Promise<{ ok: boolean; count: number }> {
  const parsed = bulkSaveDailyLogsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, count: 0 }

  const count = await saveManyDailyLogs(parsed.data.rows)
  for (const row of parsed.data.rows) revalidateDaily(row.date)
  return { ok: true, count }
}
