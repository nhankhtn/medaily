'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { METRIC_KEYS } from '@/lib/types'
import { isoDateSchema } from '@/lib/validation/daily'
import {
  deleteHabitLog,
  findHabit,
  findHabitLogsForDate,
  insertHabit,
  updateHabit,
  upsertHabitLog,
} from '@/server/repositories/habits'
import { backfillDerivedHabitLogs } from '@/server/services/habit-derivation'
import { getSettings } from '@/server/services/settings'

const toggleSchema = z.object({
  habitId: z.string().uuid(),
  date: isoDateSchema,
  count: z.number().int().min(0).max(100).optional(),
})

export type ToggleHabitResult =
  | { ok: true; completed: boolean; count: number }
  | { ok: false; error: 'not_found' | 'derived' | 'invalid_input' }

/**
 * Manual tick for a habit. A metric-linked habit is refused here: its state
 * comes from the daily log, and letting both write would put the two out of
 * step (spec 7.3).
 */
export async function toggleHabit(input: unknown): Promise<ToggleHabitResult> {
  const parsed = toggleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const userId = getCurrentUserId()
  const habit = await findHabit(userId, parsed.data.habitId)
  if (!habit) return { ok: false, error: 'not_found' }
  if (habit.linkedMetric) return { ok: false, error: 'derived' }

  const existing = (await findHabitLogsForDate(userId, parsed.data.date)).find(
    (log) => log.habitId === habit.id,
  )

  const nextCount = parsed.data.count ?? (existing ? 0 : habit.targetCount)

  if (nextCount <= 0) {
    await deleteHabitLog(habit.id, parsed.data.date, userId)
    revalidatePath('/')
    revalidatePath('/habits')
    return { ok: true, completed: false, count: 0 }
  }

  const saved = await upsertHabitLog({
    userId,
    habitId: habit.id,
    logDate: parsed.data.date,
    count: nextCount,
    completed: nextCount >= habit.targetCount,
    source: 'manual',
  })

  revalidatePath('/')
  revalidatePath('/habits')
  return { ok: true, completed: saved.completed, count: saved.count }
}


const habitSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(120),
    category: z.enum(['career', 'health', 'finance', 'knowledge', 'life']).default('life'),
    frequencyType: z.enum(['daily', 'weekly', 'specific_days', 'interval']).default('daily'),
    targetCount: z.number().int().min(1).max(50).default(1),
    weekdays: z.array(z.number().int().min(1).max(7)).max(7).nullable().optional(),
    intervalDays: z.number().int().min(1).max(365).nullable().optional(),
    linkedMetric: z.enum(METRIC_KEYS).nullable().optional(),
    linkedOperator: z.enum(['gte', 'lte', 'eq']).nullable().optional(),
    linkedThreshold: z.number().nullable().optional(),
    startDate: isoDateSchema,
    notes: z
      .string()
      .max(2000)
      .transform((value) => (value.trim() === '' ? null : value.trim()))
      .nullable()
      .optional(),
  })
  // The database enforces these too; failing here gives a usable message first.
  .refine(
    (value) => value.frequencyType !== 'specific_days' || (value.weekdays?.length ?? 0) > 0,
    { message: 'pick at least one weekday', path: ['weekdays'] },
  )
  .refine((value) => value.frequencyType !== 'interval' || (value.intervalDays ?? 0) >= 1, {
    message: 'interval must be at least one day',
    path: ['intervalDays'],
  })
  .refine(
    (value) =>
      !value.linkedMetric ||
      (value.linkedOperator !== null &&
        value.linkedOperator !== undefined &&
        value.linkedThreshold !== null &&
        value.linkedThreshold !== undefined),
    { message: 'a linked metric needs an operator and a threshold', path: ['linkedThreshold'] },
  )

export type SaveHabitResult =
  | { ok: true; id: string; backfilledDays: number }
  | { ok: false; error: 'invalid_input'; detail?: string }

/**
 * Creating or editing a habit also catches up the days already logged, so a
 * metric-linked habit is correct the moment it exists rather than only from the
 * next save onwards.
 */
export async function saveHabit(input: unknown): Promise<SaveHabitResult> {
  const parsed = habitSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input', detail: parsed.error.issues[0]?.message }
  }

  const settings = await getSettings()
  const { id, ...values } = parsed.data

  const row = {
    ...values,
    weekdays: values.frequencyType === 'specific_days' ? (values.weekdays ?? null) : null,
    intervalDays: values.frequencyType === 'interval' ? (values.intervalDays ?? null) : null,
    linkedMetric: values.linkedMetric ?? null,
    linkedOperator: values.linkedMetric ? (values.linkedOperator ?? null) : null,
    linkedThreshold:
      values.linkedMetric && values.linkedThreshold !== null && values.linkedThreshold !== undefined
        ? String(values.linkedThreshold)
        : null,
    notes: values.notes ?? null,
  }

  const { habitId, backfilledDays } = await db.transaction(async (tx) => {
    const saved = id
      ? await updateHabit(settings.userId, id, row)
      : await insertHabit({ ...row, userId: settings.userId })

    const { days } = row.linkedMetric
      ? await backfillDerivedHabitLogs(tx, settings.userId, saved.startDate, settings.weekStart)
      : { days: 0 }

    return { habitId: saved.id, backfilledDays: days }
  })

  revalidatePath('/habits')
  revalidatePath('/')
  return { ok: true, id: habitId, backfilledDays }
}

export async function archiveHabit(input: unknown) {
  const id = z.string().uuid().parse(input)
  await updateHabit(getCurrentUserId(), id, { archivedAt: new Date() })
  revalidatePath('/habits')
  revalidatePath('/')
  return { ok: true }
}

export async function unarchiveHabit(input: unknown) {
  const id = z.string().uuid().parse(input)
  await updateHabit(getCurrentUserId(), id, { archivedAt: null })
  revalidatePath('/habits')
  return { ok: true }
}
