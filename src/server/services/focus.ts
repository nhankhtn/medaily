import { db } from '@/lib/db'
import type { FocusSession } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import { insertSession } from '@/server/repositories/learning'
import { recomputeDerivedHabitLogs } from '@/server/services/habit-derivation'

/**
 * Sessions and the daily log must never disagree, so writing a session
 * recomputes that day's derived habits in the same transaction — the same rule
 * the daily save follows (spec 7.3).
 */
export async function saveSessionAndDerive(values: {
  userId: string
  sessionDate: ISODate
  minutes: number
  kind: 'learning' | 'deep_work' | 'project'
  topicId?: string | null
  projectId?: string | null
  note?: string | null
  source: 'timer' | 'manual'
  startedAt?: Date | null
  endedAt?: Date | null
  weekStart: 'monday' | 'sunday'
}): Promise<FocusSession> {
  const { weekStart, ...session } = values
  return db.transaction(async (tx) => {
    const saved = await insertSession(session)
    await recomputeDerivedHabitLogs(tx, session.userId, session.sessionDate, weekStart)
    return saved
  })
}
