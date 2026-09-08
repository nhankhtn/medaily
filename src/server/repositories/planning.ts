import { and, asc, between, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { events, plannedBlocks } from '@/lib/db/schema'
import type { CalendarEvent, PlannedBlock } from '@/lib/db/schema'
import type { DateRange } from '@/lib/dates'

export async function findEvents(
  userId: string,
  from: Date,
  to: Date,
): Promise<CalendarEvent[]> {
  return db
    .select()
    .from(events)
    .where(and(eq(events.userId, userId), gte(events.startsAt, from), lte(events.startsAt, to)))
    .orderBy(asc(events.startsAt))
}

export async function insertEvent(values: typeof events.$inferInsert): Promise<CalendarEvent> {
  const rows = await db.insert(events).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert event')
  return row
}

export async function deleteEvent(userId: string, id: string): Promise<void> {
  await db.delete(events).where(and(eq(events.userId, userId), eq(events.id, id)))
}

export async function findPlannedBlocks(
  userId: string,
  range: DateRange,
): Promise<PlannedBlock[]> {
  return db
    .select()
    .from(plannedBlocks)
    .where(
      and(
        eq(plannedBlocks.userId, userId),
        between(plannedBlocks.blockDate, range.start, range.end),
      ),
    )
    .orderBy(asc(plannedBlocks.blockDate), asc(plannedBlocks.startTime))
}

export async function insertPlannedBlock(
  values: typeof plannedBlocks.$inferInsert,
): Promise<PlannedBlock> {
  const rows = await db.insert(plannedBlocks).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert planned block')
  return row
}

export async function deletePlannedBlock(userId: string, id: string): Promise<void> {
  await db
    .delete(plannedBlocks)
    .where(and(eq(plannedBlocks.userId, userId), eq(plannedBlocks.id, id)))
}
