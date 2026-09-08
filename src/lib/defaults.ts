import type {
  InsightThresholds,
  ScoreTargets,
  ScoreWeights,
  StreakThresholds,
} from '@/lib/types'

/** Spec 19.1 — weights are percentages and must sum to 100. */
export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  focus: 30,
  sleep: 20,
  exercise: 15,
  habits: 15,
  reading: 10,
  entertainment: 10,
}

/** Spec 19.2 */
export const DEFAULT_SCORE_TARGETS: ScoreTargets = {
  studyMinutes: 60,
  deepWorkMinutes: 120,
  sleepIdealMin: 7,
  sleepIdealMax: 9,
  exerciseFullMinutes: 30,
  exercisePartialMinutes: 15,
  readingMinutes: 20,
  entertainmentFreeMinutes: 60,
  entertainmentZeroMinutes: 180,
  restDayCreditEnabled: true,
  restDayExerciseDays: 4,
}

/** Spec 20.3 */
export const DEFAULT_STREAK_THRESHOLDS: StreakThresholds = {
  studyMinutes: 30,
  deepWorkMinutes: 60,
  readingMinutes: 10,
}

/** Spec 18.4 */
export const DEFAULT_INSIGHT_THRESHOLDS: InsightThresholds = {
  sleepDeficitHours: 6,
  sleepDeficitDays: 3,
  sleepDebtAvgHours: 6.5,
  entertainmentDailyMinutes: 120,
  entertainmentDaysOfWeek: 4,
  exerciseGapDays: 5,
  studySlumpRatio: 0.6,
  energyDeclinePoints: 1.5,
  loggingGapDays: 2,
  goalOffPaceDays: 14,
  goalOffPaceProgress: 60,
}

export const DEFAULT_DASHBOARD_CARDS = [
  'today',
  'week',
  'streaks',
  'insights',
  'trends',
  'goals',
  'habits',
  'reviews',
  'notes',
] as const

/** Minimum logged days before a period score is shown at all (spec 19.4). */
export const WEEK_SCORE_MIN_COVERAGE = 4
export const MONTH_SCORE_MIN_COVERAGE_RATIO = 0.4

/** Correlation gates (spec 18.3). */
export const CORRELATION_MIN_DAYS = 21
export const CORRELATION_MIN_BUCKET_DAYS = 7
export const CORRELATION_MIN_EFFECT_RATIO = 0.05
