import { and, asc, between, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { focusSessions, resources, timerState, topics } from '@/lib/db/schema'
import type { FocusSession, Resource, ResourceInsert, Topic } from '@/lib/db/schema'
import type { DateRange, ISODate } from '@/lib/dates'

export async function findTopics(userId: string): Promise<Topic[]> {
  return db
    .select()
    .from(topics)
    .where(and(eq(topics.userId, userId), isNull(topics.archivedAt)))
    .orderBy(asc(topics.name))
}

export async function insertTopic(values: {
  userId: string
  name: string
  category?: string | null
  parentId?: string | null
}): Promise<Topic> {
  const rows = await db.insert(topics).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert topic')
  return row
}

export async function findSessions(
  userId: string,
  range: DateRange,
  limit = 200,
): Promise<FocusSession[]> {
  return db
    .select()
    .from(focusSessions)
    .where(
      and(
        eq(focusSessions.userId, userId),
        between(focusSessions.sessionDate, range.start, range.end),
      ),
    )
    .orderBy(desc(focusSessions.sessionDate), desc(focusSessions.createdAt))
    .limit(limit)
}

export async function insertSession(values: {
  userId: string
  sessionDate: ISODate
  minutes: number
  kind: 'learning' | 'deep_work' | 'project'
  topicId?: string | null
  projectId?: string | null
  taskId?: string | null
  note?: string | null
  source?: 'timer' | 'manual'
  startedAt?: Date | null
  endedAt?: Date | null
}): Promise<FocusSession> {
  const rows = await db.insert(focusSessions).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert focus session')
  return row
}

export async function updateSession(
  userId: string,
  sessionId: string,
  patch: Partial<typeof focusSessions.$inferInsert>,
): Promise<FocusSession> {
  const rows = await db
    .update(focusSessions)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(focusSessions.userId, userId), eq(focusSessions.id, sessionId)))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('session not found')
  return row
}

export async function deleteSession(userId: string, sessionId: string): Promise<void> {
  await db
    .delete(focusSessions)
    .where(and(eq(focusSessions.userId, userId), eq(focusSessions.id, sessionId)))
}

export async function findSessionDate(userId: string, sessionId: string): Promise<ISODate | null> {
  const rows = await db
    .select({ sessionDate: focusSessions.sessionDate })
    .from(focusSessions)
    .where(and(eq(focusSessions.userId, userId), eq(focusSessions.id, sessionId)))
    .limit(1)
  return rows[0]?.sessionDate ?? null
}

export type TopicTotal = { topicId: string | null; name: string | null; minutes: number }

export async function sumMinutesByTopic(
  userId: string,
  range: DateRange,
): Promise<TopicTotal[]> {
  const rows = await db
    .select({
      topicId: focusSessions.topicId,
      name: topics.name,
      minutes: sql<number>`COALESCE(SUM(${focusSessions.minutes}), 0)::int`,
    })
    .from(focusSessions)
    .leftJoin(topics, eq(topics.id, focusSessions.topicId))
    .where(
      and(
        eq(focusSessions.userId, userId),
        between(focusSessions.sessionDate, range.start, range.end),
      ),
    )
    .groupBy(focusSessions.topicId, topics.name)
    .orderBy(desc(sql`SUM(${focusSessions.minutes})`))

  return rows
}

export async function findResources(userId: string): Promise<Resource[]> {
  return db
    .select()
    .from(resources)
    .where(and(eq(resources.userId, userId), isNull(resources.archivedAt)))
    .orderBy(asc(resources.status), desc(resources.updatedAt))
}

export async function upsertResource(
  userId: string,
  values: Omit<ResourceInsert, 'userId'> & { id?: string },
): Promise<Resource> {
  if (values.id) {
    const rows = await db
      .update(resources)
      .set({ ...values, updatedAt: new Date() })
      .where(and(eq(resources.userId, userId), eq(resources.id, values.id)))
      .returning()
    const row = rows[0]
    if (!row) throw new Error('resource not found')
    return row
  }

  const rows = await db
    .insert(resources)
    .values({ ...values, userId })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert resource')
  return row
}

export async function findTimer(userId: string) {
  const rows = await db.select().from(timerState).where(eq(timerState.userId, userId)).limit(1)
  return rows[0] ?? null
}

/**
 * The timer lives server-side so it survives a refresh and follows the user
 * between devices (spec 10.3).
 */
export async function startTimer(values: {
  userId: string
  startedAt: Date
  kind: 'learning' | 'deep_work' | 'project'
  topicId?: string | null
  projectId?: string | null
  note?: string | null
}) {
  await db
    .insert(timerState)
    .values(values)
    .onConflictDoUpdate({ target: timerState.userId, set: { ...values, updatedAt: new Date() } })
}

export async function clearTimer(userId: string) {
  await db.delete(timerState).where(eq(timerState.userId, userId))
}
