import type { DailyLog } from '@/lib/db/schema'
import type { DailyLogPatchInput } from '@/lib/validation/daily'

/** Every field the daily form owns, always present, `null` meaning "not logged". */
export type DailyFormValues = {
  energy: number | null
  mood: number | null
  sleepHours: number | null
  bedtime: string | null
  wakeTime: string | null
  technicalStudyMinutes: number | null
  deepWorkMinutes: number | null
  exerciseMinutes: number | null
  exerciseType: string | null
  readingMinutes: number | null
  readingPages: number | null
  entertainmentMinutes: number | null
  englishMinutes: number | null
  dailyWin: string | null
  dailyProblem: string | null
  tomorrowPriority: string | null
  note: string | null
}

export const EMPTY_VALUES: DailyFormValues = {
  energy: null,
  mood: null,
  sleepHours: null,
  bedtime: null,
  wakeTime: null,
  technicalStudyMinutes: null,
  deepWorkMinutes: null,
  exerciseMinutes: null,
  exerciseType: null,
  readingMinutes: null,
  readingPages: null,
  entertainmentMinutes: null,
  englishMinutes: null,
  dailyWin: null,
  dailyProblem: null,
  tomorrowPriority: null,
  note: null,
}

export const ESSENTIAL_FIELDS = [
  'energy',
  'sleepHours',
  'technicalStudyMinutes',
  'deepWorkMinutes',
] as const satisfies readonly (keyof DailyFormValues)[]

export const ACTIVITY_FIELDS = [
  'exerciseMinutes',
  'readingMinutes',
  'entertainmentMinutes',
  'englishMinutes',
  'mood',
] as const satisfies readonly (keyof DailyFormValues)[]

export const REFLECTION_FIELDS = [
  'dailyWin',
  'dailyProblem',
  'tomorrowPriority',
  'note',
] as const satisfies readonly (keyof DailyFormValues)[]

export function valuesFromLog(log: DailyLog | null): DailyFormValues {
  if (!log) return { ...EMPTY_VALUES }
  return {
    energy: log.energy,
    mood: log.mood,
    sleepHours: log.sleepHours === null ? null : Number(log.sleepHours),
    bedtime: log.bedtime ? log.bedtime.slice(0, 5) : null,
    wakeTime: log.wakeTime ? log.wakeTime.slice(0, 5) : null,
    technicalStudyMinutes: log.technicalStudyMinutes,
    deepWorkMinutes: log.deepWorkMinutes,
    exerciseMinutes: log.exerciseMinutes,
    exerciseType: log.exerciseType,
    readingMinutes: log.readingMinutes,
    readingPages: log.readingPages,
    entertainmentMinutes: log.entertainmentMinutes,
    englishMinutes: log.englishMinutes,
    dailyWin: log.dailyWin,
    dailyProblem: log.dailyProblem,
    tomorrowPriority: log.tomorrowPriority,
    note: log.note,
  }
}

export function toPatch(values: DailyFormValues): DailyLogPatchInput {
  return {
    energy: values.energy,
    mood: values.mood,
    sleepHours: values.sleepHours,
    bedtime: values.bedtime,
    wakeTime: values.wakeTime,
    technicalStudyMinutes: values.technicalStudyMinutes,
    deepWorkMinutes: values.deepWorkMinutes,
    exerciseMinutes: values.exerciseMinutes,
    exerciseType: values.exerciseType ?? '',
    readingMinutes: values.readingMinutes,
    readingPages: values.readingPages,
    entertainmentMinutes: values.entertainmentMinutes,
    englishMinutes: values.englishMinutes,
    dailyWin: values.dailyWin ?? '',
    dailyProblem: values.dailyProblem ?? '',
    tomorrowPriority: values.tomorrowPriority ?? '',
    note: values.note ?? '',
  }
}

export function countFilled(
  values: DailyFormValues,
  fields: readonly (keyof DailyFormValues)[],
): number {
  return fields.filter((field) => {
    const value = values[field]
    if (value === null) return false
    if (typeof value === 'string') return value.trim().length > 0
    return true
  }).length
}

/** Minutes + sleep, used by the soft 20-hour sanity check (spec 5.2). */
export function trackedHours(values: DailyFormValues): number {
  const minutes =
    (values.technicalStudyMinutes ?? 0) +
    (values.deepWorkMinutes ?? 0) +
    (values.exerciseMinutes ?? 0) +
    (values.readingMinutes ?? 0) +
    (values.entertainmentMinutes ?? 0) +
    (values.englishMinutes ?? 0)
  return minutes / 60 + (values.sleepHours ?? 0)
}
