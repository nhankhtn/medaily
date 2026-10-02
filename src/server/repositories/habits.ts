import { and, asc, between, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db, type DbOrTx } from '@/lib/db'
import { habitLogs, habits } from '@/lib/db/schema'
import type { Habit, HabitInsert, HabitLog } from '@/lib/db/schema'
import type { DateRange, ISODate } from '@/lib/dates'

export async function findHabits(
  userId: string,
  { includeArchived = false }: { includeArchived?: boolean } = {},
): Promise<Habit[]> {
  return db
    .select()
    .from(habits)
    .where(
      includeArchived
        ? eq(habits.userId, userId)
        : and(eq(habits.userId, userId), isNull(habits.archivedAt)),
    )
    .orderBy(asc(habits.sortOrder), asc(habits.createdAt))
}

/** Habits active on a date, i.e. inside their start/end window. */
export async function findHabitsActiveOn(
  userId: string,
  date: ISODate,
  tx: DbOrTx = db,
): Promise<Habit[]> {
  return tx
    .select()
    .from(habits)
    .where(
      and(
        eq(habits.userId, userId),
        isNull(habits.archivedAt),
        sql`${habits.startDate} <= ${date}`,
        or(isNull(habits.endDate), sql`${habits.endDate} >= ${date}`),
      ),
    )
    .orderBy(asc(habits.sortOrder), asc(habits.createdAt))
}

export async function findHabitLogsForDate(
  userId: string,
  date: ISODate,
  tx: DbOrTx = db,
): Promise<HabitLog[]> {
  return tx
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), eq(habitLogs.logDate, date)))
}

export async function findHabitLogsInRange(
  userId: string,
  range: DateRange,
): Promise<HabitLog[]> {
  return db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), between(habitLogs.logDate, range.start, range.end)))
    .orderBy(asc(habitLogs.logDate))
}

export type HabitLogValues = {
  userId: string
  habitId: string
  logDate: ISODate
  count: number
  completed: boolean
  source: 'manual' | 'derived' | 'import' | 'catch_up'
  note?: string | null
}

/**
 * One statement whatever the length. Derivation settles every linked habit for
 * a date at once, and a round trip each would be the slowest thing a save does.
 */
export async function upsertHabitLogs(
  values: HabitLogValues[],
  tx: DbOrTx = db,
): Promise<HabitLog[]> {
  if (values.length === 0) return []

  return tx
    .insert(habitLogs)
    .values(values)
    .onConflictDoUpdate({
      target: [habitLogs.habitId, habitLogs.logDate],
      // `excluded` is the row this statement tried to insert, so every row in
      // the batch updates from its own values rather than from the first.
      set: {
        count: sql`excluded.count`,
        completed: sql`excluded.completed`,
        source: sql`excluded.source`,
        updatedAt: new Date(),
      },
    })
    .returning()
}

export async function upsertHabitLog(
  values: HabitLogValues,
  tx: DbOrTx = db,
): Promise<HabitLog> {
  const row = (await upsertHabitLogs([values], tx))[0]
  if (!row) throw new Error('failed to upsert habit log')
  return row
}

/** One statement for a whole date's worth of habits that no longer qualify. */
export async function deleteHabitLogs(
  habitIds: string[],
  date: ISODate,
  userId: string,
  tx: DbOrTx = db,
): Promise<void> {
  if (habitIds.length === 0) return

  await tx
    .delete(habitLogs)
    .where(
      and(
        eq(habitLogs.userId, userId),
        inArray(habitLogs.habitId, habitIds),
        eq(habitLogs.logDate, date),
      ),
    )
}

export async function deleteHabitLog(
  habitId: string,
  date: ISODate,
  userId: string,
  tx: DbOrTx = db,
): Promise<void> {
  await deleteHabitLogs([habitId], date, userId, tx)
}

export async function insertHabit(values: HabitInsert): Promise<Habit> {
  const rows = await db.insert(habits).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert habit')
  return row
}

export async function updateHabit(
  userId: string,
  habitId: string,
  patch: Partial<HabitInsert>,
): Promise<Habit> {
  const rows = await db
    .update(habits)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(habits.userId, userId), eq(habits.id, habitId)))
    .returning()
  const row = rows[0]
  if (!row) throw new Error('habit not found')
  return row
}

export async function findHabit(userId: string, habitId: string): Promise<Habit | null> {
  const rows = await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.id, habitId)))
    .limit(1)
  return rows[0] ?? null
}
