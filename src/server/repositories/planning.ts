import { and, asc, between, eq, gte, isNotNull, isNull, lte, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { events, plannedBlocks } from '@/lib/db/schema'
import type { CalendarEvent, PlannedBlock } from '@/lib/db/schema'
import { toISODate, type DateRange } from '@/lib/dates'

/**
 * Rows that can show up between `from` and `to`. A repeating event is stored
 * once, at its first occurrence, so it qualifies whenever the series has begun
 * and has not run out — the occurrences themselves come from `expandAll`.
 */
export async function findEvents(
  userId: string,
  from: Date,
  to: Date,
): Promise<CalendarEvent[]> {
  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        lte(events.startsAt, to),
        or(
          and(isNull(events.recurrenceRule), gte(events.startsAt, from)),
          and(
            isNotNull(events.recurrenceRule),
            or(
              isNull(events.recurrenceUntil),
              gte(events.recurrenceUntil, toISODate(from)),
            ),
          ),
        ),
      ),
    )
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
