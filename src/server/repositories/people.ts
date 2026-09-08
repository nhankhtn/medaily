import { and, asc, desc, eq, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { interactions, people, reminders } from '@/lib/db/schema'
import type { Interaction, Person, PersonInsert, Reminder } from '@/lib/db/schema'
import type { ISODate } from '@/lib/dates'

export async function findPeople(userId: string): Promise<Person[]> {
  return db
    .select()
    .from(people)
    .where(and(eq(people.userId, userId), isNull(people.archivedAt)))
    .orderBy(asc(people.name))
}

export async function insertPerson(values: PersonInsert): Promise<Person> {
  const rows = await db.insert(people).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert person')
  return row
}

export async function updatePerson(
  userId: string,
  personId: string,
  patch: Partial<PersonInsert>,
): Promise<Person> {
  const rows = await db
    .update(people)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(people.userId, userId), eq(people.id, personId)))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('person not found')
  return row
}

export async function findInteractions(userId: string, limit = 50): Promise<Interaction[]> {
  return db
    .select()
    .from(interactions)
    .where(eq(interactions.userId, userId))
    .orderBy(desc(interactions.occurredOn))
    .limit(limit)
}

export async function insertInteraction(
  values: typeof interactions.$inferInsert,
): Promise<Interaction> {
  const rows = await db.insert(interactions).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert interaction')
  return row
}

/** Last contact per person, derived rather than stored so it cannot drift. */
export async function lastInteractionByPerson(userId: string): Promise<Map<string, ISODate>> {
  const rows = await db
    .select({
      personId: interactions.personId,
      lastOn: sql<string>`MAX(${interactions.occurredOn})`,
    })
    .from(interactions)
    .where(eq(interactions.userId, userId))
    .groupBy(interactions.personId)

  return new Map(rows.map((row) => [row.personId, row.lastOn]))
}

export async function findReminders(userId: string, until: ISODate): Promise<Reminder[]> {
  return db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.userId, userId),
        isNull(reminders.doneAt),
        lte(reminders.dueOn, until),
        or(isNull(reminders.snoozedUntil), lte(reminders.snoozedUntil, until)),
      ),
    )
    .orderBy(asc(reminders.dueOn))
}

export async function insertReminder(values: typeof reminders.$inferInsert): Promise<Reminder> {
  const rows = await db.insert(reminders).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert reminder')
  return row
}

export async function completeReminder(userId: string, id: string): Promise<void> {
  await db
    .update(reminders)
    .set({ doneAt: new Date() })
    .where(and(eq(reminders.userId, userId), eq(reminders.id, id)))
}
