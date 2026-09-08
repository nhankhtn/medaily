import { and, asc, between, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bodyMeasurements, nutritionLogs, workoutSets, workouts } from '@/lib/db/schema'
import type { BodyMeasurement, NutritionLog, Workout, WorkoutSet } from '@/lib/db/schema'
import type { DateRange, ISODate } from '@/lib/dates'

export async function findWorkouts(userId: string, range: DateRange): Promise<Workout[]> {
  return db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), between(workouts.performedOn, range.start, range.end)))
    .orderBy(desc(workouts.performedOn))
}

export async function findWorkoutSets(workoutIds: string[]): Promise<WorkoutSet[]> {
  if (workoutIds.length === 0) return []
  return db
    .select()
    .from(workoutSets)
    .where(inArray(workoutSets.workoutId, workoutIds))
    .orderBy(asc(workoutSets.sortOrder))
}

export async function insertWorkout(values: typeof workouts.$inferInsert): Promise<Workout> {
  const rows = await db.insert(workouts).values(values).returning()
  const row = rows[0]
  if (!row) throw new Error('failed to insert workout')
  return row
}

export async function insertWorkoutSets(values: (typeof workoutSets.$inferInsert)[]) {
  if (values.length === 0) return
  await db.insert(workoutSets).values(values)
}

export async function deleteWorkout(userId: string, workoutId: string): Promise<void> {
  await db.delete(workouts).where(and(eq(workouts.userId, userId), eq(workouts.id, workoutId)))
}

export async function findMeasurements(
  userId: string,
  range: DateRange,
): Promise<BodyMeasurement[]> {
  return db
    .select()
    .from(bodyMeasurements)
    .where(
      and(
        eq(bodyMeasurements.userId, userId),
        between(bodyMeasurements.measuredOn, range.start, range.end),
      ),
    )
    .orderBy(asc(bodyMeasurements.measuredOn))
}

export async function upsertMeasurement(
  values: typeof bodyMeasurements.$inferInsert,
): Promise<BodyMeasurement> {
  const rows = await db
    .insert(bodyMeasurements)
    .values(values)
    .onConflictDoUpdate({
      target: [bodyMeasurements.userId, bodyMeasurements.measuredOn],
      set: { ...values, updatedAt: new Date() },
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('failed to upsert measurement')
  return row
}

export async function findNutrition(userId: string, range: DateRange): Promise<NutritionLog[]> {
  return db
    .select()
    .from(nutritionLogs)
    .where(
      and(eq(nutritionLogs.userId, userId), between(nutritionLogs.logDate, range.start, range.end)),
    )
    .orderBy(desc(nutritionLogs.logDate))
}

export async function upsertNutrition(
  values: typeof nutritionLogs.$inferInsert,
): Promise<NutritionLog> {
  const rows = await db
    .insert(nutritionLogs)
    .values(values)
    .onConflictDoUpdate({
      target: [nutritionLogs.userId, nutritionLogs.logDate],
      set: { ...values, updatedAt: new Date() },
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('failed to upsert nutrition log')
  return row
}

/** Exercise minutes already recorded on the daily log for a date. */
export async function dailyExerciseMinutes(
  userId: string,
  date: ISODate,
): Promise<number | null> {
  const rows = await db.execute<{ exercise_minutes: number | null }>(sql`
    SELECT exercise_minutes FROM daily_logs
    WHERE user_id = ${userId} AND log_date = ${date}
    LIMIT 1
  `)
  return rows[0]?.exercise_minutes ?? null
}
