import { and, asc, between, eq, isNull, or, sql } from 'drizzle-orm'
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

export async function upsertHabitLog(
  values: {
    userId: string
    habitId: string
    logDate: ISODate
    count: number
    completed: boolean
    source: 'manual' | 'derived' | 'import' | 'catch_up'
    note?: string | null
  },
  tx: DbOrTx = db,
): Promise<HabitLog> {
  const rows = await tx
    .insert(habitLogs)
    .values(values)
    .onConflictDoUpdate({
      target: [habitLogs.habitId, habitLogs.logDate],
      set: {
        count: values.count,
        completed: values.completed,
        source: values.source,
        updatedAt: new Date(),
      },
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('failed to upsert habit log')
  return row
}

export async function deleteHabitLog(
  habitId: string,
  date: ISODate,
  userId: string,
  tx: DbOrTx = db,
): Promise<void> {
  await tx
    .delete(habitLogs)
    .where(
      and(
        eq(habitLogs.userId, userId),
        eq(habitLogs.habitId, habitId),
        eq(habitLogs.logDate, date),
      ),
    )
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
