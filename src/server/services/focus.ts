import { db } from '@/lib/db'
import type { FocusSession } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'
import { findTopic, insertSession } from '@/server/repositories/learning'
import { findProject } from '@/server/repositories/projects'
import { ownedOrNull } from '@/server/services/ownership'
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
  const { weekStart, ...rest } = values
  // Every path that files a session — the form, the timer, a completed run —
  // ends here, so this is the one place a foreign topic or project is dropped.
  const [topicId, projectId] = await Promise.all([
    ownedOrNull(rest.userId, rest.topicId ?? null, findTopic),
    ownedOrNull(rest.userId, rest.projectId ?? null, findProject),
  ])
  const session = { ...rest, topicId, projectId }
  return db.transaction(async (tx) => {
    const saved = await insertSession(session)
    await recomputeDerivedHabitLogs(tx, session.userId, session.sessionDate, weekStart)
    return saved
  })
}
