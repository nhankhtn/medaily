'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { isoDateSchema } from '@/lib/validation/daily'
import { upsertLog } from '@/server/repositories/daily'
import {
  dailyExerciseMinutes,
  deleteWorkout,
  insertWorkout,
  insertWorkoutSets,
  upsertMeasurement,
  upsertNutrition,
} from '@/server/repositories/health'
import { recomputeDerivedHabitLogs } from '@/server/services/habit-derivation'
import { getSettings } from '@/server/services/settings'

const optionalNumber = z.number().nullable().optional()

const workoutSchema = z.object({
  performedOn: isoDateSchema,
  type: z.string().min(1).max(80),
  durationMinutes: z.number().int().min(1).max(1440),
  distanceKm: optionalNumber,
  calories: z.number().int().min(0).max(20000).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  sets: z
    .array(
      z.object({
        exercise: z.string().min(1).max(120),
        sets: z.number().int().min(1).max(50).nullable().optional(),
        reps: z.number().int().min(1).max(500).nullable().optional(),
        weightKg: optionalNumber,
      }),
    )
    .max(30)
    .optional(),
})

/**
 * Spec 11 — a workout back-fills `daily_logs.exercise_minutes` when that field
 * is still empty, so the dashboard and the score see the session without asking
 * the user to type it twice. An existing value is never overwritten.
 */
export async function saveWorkout(input: unknown) {
  const parsed = workoutSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const settings = await getSettings()
  const { sets, ...values } = parsed.data

  const workout = await insertWorkout({
    ...values,
    userId: settings.userId,
    distanceKm: values.distanceKm === null || values.distanceKm === undefined ? null : String(values.distanceKm),
  })

  if (sets?.length) {
    await insertWorkoutSets(
      sets.map((set, index) => ({
        workoutId: workout.id,
        exercise: set.exercise,
        sets: set.sets ?? null,
        reps: set.reps ?? null,
        weightKg: set.weightKg === null || set.weightKg === undefined ? null : String(set.weightKg),
        sortOrder: index,
      })),
    )
  }

  const existing = await dailyExerciseMinutes(settings.userId, values.performedOn)
  if (existing === null) {
    await db.transaction(async (tx) => {
      await upsertLog(
        settings.userId,
        values.performedOn,
        { exerciseMinutes: values.durationMinutes, exerciseType: values.type },
        tx,
      )
      await recomputeDerivedHabitLogs(tx, settings.userId, values.performedOn, settings.weekStart)
    })
  }

  revalidatePath('/health')
  revalidatePath('/daily')
  revalidatePath('/')
  return { ok: true as const, backfilled: existing === null }
}

export async function removeWorkout(input: unknown) {
  const id = z.string().uuid().parse(input)
  await deleteWorkout(getCurrentUserId(), id)
  revalidatePath('/health')
  return { ok: true }
}

const measurementSchema = z.object({
  measuredOn: isoDateSchema,
  weightKg: optionalNumber,
  bodyFatPct: optionalNumber,
  waistCm: optionalNumber,
  restingHr: z.number().int().min(20).max(220).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
})

export async function saveMeasurement(input: unknown) {
  const parsed = measurementSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const toNumeric = (value: number | null | undefined) =>
    value === null || value === undefined ? null : String(value)

  await upsertMeasurement({
    userId: getCurrentUserId(),
    measuredOn: parsed.data.measuredOn,
    weightKg: toNumeric(parsed.data.weightKg),
    bodyFatPct: toNumeric(parsed.data.bodyFatPct),
    waistCm: toNumeric(parsed.data.waistCm),
    restingHr: parsed.data.restingHr ?? null,
    note: parsed.data.note ?? null,
  })

  revalidatePath('/health')
  return { ok: true as const }
}

const nutritionSchema = z.object({
  logDate: isoDateSchema,
  calories: z.number().int().min(0).max(20000).nullable().optional(),
  proteinG: z.number().int().min(0).max(2000).nullable().optional(),
  carbsG: z.number().int().min(0).max(2000).nullable().optional(),
  fatG: z.number().int().min(0).max(2000).nullable().optional(),
  waterMl: z.number().int().min(0).max(20000).nullable().optional(),
})

export async function saveNutrition(input: unknown) {
  const parsed = nutritionSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  await upsertNutrition({ ...parsed.data, userId: getCurrentUserId() })
  revalidatePath('/health')
  return { ok: true as const }
}
