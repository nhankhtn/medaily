import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import type { BodyMeasurement, NutritionLog, Workout, WorkoutSet } from '@/lib/db/schema'
import { movingAverage } from '@/lib/analytics/stats'
import { rangeOfLastDays, today as todayOf, type ISODate } from '@/lib/dates'
import {
  findMeasurements,
  findNutrition,
  findWorkoutSets,
  findWorkouts,
} from '@/server/repositories/health'
import { dayContextOf, getSettings } from '@/server/services/settings'

export type HealthData = {
  today: ISODate
  workouts: (Workout & { sets: WorkoutSet[] })[]
  measurements: BodyMeasurement[]
  /** Weight with a 7-day trailing average, so daily noise does not read as progress. */
  weightSeries: { date: ISODate; value: number | null; average: number | null }[]
  nutrition: NutritionLog[]
  unitSystem: 'metric' | 'imperial'
  totals: { workoutCount: number; minutes: number; latestWeight: number | null }
}

export const getHealthData = cache(async (days = 90): Promise<HealthData> => {
  const settings = await getSettings()
  const userId = await getCurrentUserId()
  const today = todayOf(dayContextOf(settings))
  const range = rangeOfLastDays(today, days)

  const [workoutRows, measurements, nutrition] = await Promise.all([
    findWorkouts(userId, range),
    findMeasurements(userId, range),
    findNutrition(userId, rangeOfLastDays(today, 14)),
  ])

  const sets = await findWorkoutSets(workoutRows.map((workout) => workout.id))

  const weights = measurements.map((row) => (row.weightKg === null ? null : Number(row.weightKg)))
  const averages = movingAverage(weights, 7)

  return {
    today,
    workouts: workoutRows.map((workout) => ({
      ...workout,
      sets: sets.filter((set) => set.workoutId === workout.id),
    })),
    measurements,
    weightSeries: measurements.map((row, index) => ({
      date: row.measuredOn,
      value: weights[index] ?? null,
      average: averages[index] ?? null,
    })),
    nutrition,
    unitSystem: settings.unitSystem,
    totals: {
      workoutCount: workoutRows.length,
      minutes: workoutRows.reduce((sum, workout) => sum + workout.durationMinutes, 0),
      latestWeight: [...weights].reverse().find((value) => value !== null) ?? null,
    },
  }
})
