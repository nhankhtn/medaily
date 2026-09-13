import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { timerState } from '@/lib/db/schema'
import type { TimerState } from '@/lib/db/schema'

export type TimerInsert = typeof timerState.$inferInsert

export async function findTimer(userId: string): Promise<TimerState | null> {
  const rows = await db.select().from(timerState).where(eq(timerState.userId, userId)).limit(1)
  return rows[0] ?? null
}

/**
 * The timer lives server-side so it survives a refresh and follows the user
 * between devices (spec 10.3). Starting replaces whatever was there: one run
 * per person, which is what a person can actually do.
 */
export async function startTimer(values: TimerInsert): Promise<void> {
  await db
    .insert(timerState)
    .values(values)
    .onConflictDoUpdate({
      target: timerState.userId,
      set: { ...values, updatedAt: new Date() },
    })
}

export async function updateTimer(
  userId: string,
  values: Partial<TimerInsert>,
): Promise<TimerState | null> {
  const rows = await db
    .update(timerState)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(timerState.userId, userId))
    .returning()
  return rows[0] ?? null
}

export async function clearTimer(userId: string): Promise<void> {
  await db.delete(timerState).where(eq(timerState.userId, userId))
}
