'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { isoDateSchema } from '@/lib/validation/daily'
import {
  deleteHabitLog,
  findHabit,
  findHabitLogsForDate,
  upsertHabitLog,
} from '@/server/repositories/habits'

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
