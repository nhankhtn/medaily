import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './core'

export const workouts = pgTable(
  'workouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    performedOn: date('performed_on').notNull(),
    type: text('type').notNull(),
    durationMinutes: smallint('duration_minutes').notNull(),
    distanceKm: numeric('distance_km', { precision: 6, scale: 2 }),
    calories: smallint('calories'),
    /** Rate of perceived exertion, 1–10. */
    rpe: smallint('rpe'),
    note: text('note'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_workouts_user_date').on(t.userId, t.performedOn.desc()),
    check('duration_range', sql`${t.durationMinutes} BETWEEN 1 AND 1440`),
    check('rpe_range', sql`${t.rpe} IS NULL OR ${t.rpe} BETWEEN 1 AND 10`),
  ],
)

export const workoutSets = pgTable('workout_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  workoutId: uuid('workout_id')
    .notNull()
    .references(() => workouts.id, { onDelete: 'cascade' }),
  exercise: text('exercise').notNull(),
  sets: smallint('sets'),
  reps: smallint('reps'),
  weightKg: numeric('weight_kg', { precision: 6, scale: 2 }),
  restSeconds: smallint('rest_seconds'),
  sortOrder: smallint('sort_order').notNull().default(0),
})

/** Stored metric; the display unit follows `user_settings.unit_system` (spec 11). */
export const bodyMeasurements = pgTable(
  'body_measurements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    measuredOn: date('measured_on').notNull(),
    weightKg: numeric('weight_kg', { precision: 5, scale: 2 }),
    bodyFatPct: numeric('body_fat_pct', { precision: 4, scale: 1 }),
    waistCm: numeric('waist_cm', { precision: 5, scale: 1 }),
    restingHr: smallint('resting_hr'),
    bloodPressure: text('blood_pressure'),
    note: text('note'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('body_measurements_user_date_uniq').on(t.userId, t.measuredOn),
    index('idx_measurements_user_date').on(t.userId, t.measuredOn.desc()),
    check('weight_range', sql`${t.weightKg} IS NULL OR ${t.weightKg} BETWEEN 20 AND 400`),
    check('hr_range', sql`${t.restingHr} IS NULL OR ${t.restingHr} BETWEEN 20 AND 220`),
  ],
)

/** Four numbers a day beats searching a food database (spec 11). */
export const nutritionLogs = pgTable(
  'nutrition_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    logDate: date('log_date').notNull(),
    calories: smallint('calories'),
    proteinG: smallint('protein_g'),
    carbsG: smallint('carbs_g'),
    fatG: smallint('fat_g'),
    waterMl: smallint('water_ml'),
    note: text('note'),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('nutrition_logs_user_date_uniq').on(t.userId, t.logDate),
    check('calories_range', sql`${t.calories} IS NULL OR ${t.calories} BETWEEN 0 AND 20000`),
  ],
)

export type Workout = typeof workouts.$inferSelect
export type WorkoutInsert = typeof workouts.$inferInsert
export type WorkoutSet = typeof workoutSets.$inferSelect
export type BodyMeasurement = typeof bodyMeasurements.$inferSelect
export type NutritionLog = typeof nutritionLogs.$inferSelect
