import { z } from 'zod'
import { ISO_DATE_RE } from '@/lib/dates'

export const isoDateSchema = z.string().regex(ISO_DATE_RE, 'expected yyyy-MM-dd')

const scale = z.number().int().min(1).max(10).nullable()
const minutes = z.number().int().min(0).max(1440).nullable()
const text = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => {
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    })
    .nullable()

/**
 * The one schema every daily-log write passes through: Server Actions, the
 * catch-up grid, the quick log and the importer (spec 26.1).
 */
export const dailyLogPatchSchema = z.object({
  energy: scale.optional(),
  mood: scale.optional(),
  sleepHours: z.number().min(0).max(24).nullable().optional(),
  bedtime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  wakeTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional(),
  technicalStudyMinutes: minutes.optional(),
  deepWorkMinutes: minutes.optional(),
  exerciseMinutes: minutes.optional(),
  exerciseType: text(80).optional(),
  readingMinutes: minutes.optional(),
  readingPages: z.number().int().min(0).max(10000).nullable().optional(),
  entertainmentMinutes: minutes.optional(),
  englishMinutes: minutes.optional(),
  dailyWin: text(500).optional(),
  dailyProblem: text(500).optional(),
  tomorrowPriority: text(500).optional(),
  note: text(5000).optional(),
})

export type DailyLogPatchInput = z.infer<typeof dailyLogPatchSchema>

export const saveDailyLogSchema = z.object({
  date: isoDateSchema,
  patch: dailyLogPatchSchema,
  source: z.enum(['manual', 'catch_up', 'import']).default('manual'),
})

export const bulkSaveDailyLogsSchema = z.object({
  rows: z
    .array(z.object({ date: isoDateSchema, patch: dailyLogPatchSchema }))
    .min(1)
    .max(31),
})

/**
 * Soft sanity check (spec 5.2): more than 20 tracked hours in a day is almost
 * certainly a typo, but it is surfaced as a warning and never blocks a save —
 * the user knows their day better than the validator does.
 */
export function exceedsDayBudget(patch: DailyLogPatchInput): boolean {
  const minutesTotal =
    (patch.technicalStudyMinutes ?? 0) +
    (patch.deepWorkMinutes ?? 0) +
    (patch.exerciseMinutes ?? 0) +
    (patch.readingMinutes ?? 0) +
    (patch.entertainmentMinutes ?? 0) +
    (patch.englishMinutes ?? 0)
  const sleepMinutes = (patch.sleepHours ?? 0) * 60
  return minutesTotal + sleepMinutes > 20 * 60
}
