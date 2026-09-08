/** Shared domain types used by both the schema layer and pure domain logic. */

export const SCORE_COMPONENTS = [
  'focus',
  'sleep',
  'exercise',
  'habits',
  'reading',
  'entertainment',
] as const
export type ScoreComponent = (typeof SCORE_COMPONENTS)[number]

export type ScoreWeights = Record<ScoreComponent, number>

export type ScoreTargets = {
  studyMinutes: number
  deepWorkMinutes: number
  sleepIdealMin: number
  sleepIdealMax: number
  exerciseFullMinutes: number
  exercisePartialMinutes: number
  readingMinutes: number
  entertainmentFreeMinutes: number
  entertainmentZeroMinutes: number
  restDayCreditEnabled: boolean
  restDayExerciseDays: number
}

export type StreakThresholds = {
  studyMinutes: number
  deepWorkMinutes: number
  readingMinutes: number
}

export type InsightThresholds = {
  sleepDeficitHours: number
  sleepDeficitDays: number
  sleepDebtAvgHours: number
  entertainmentDailyMinutes: number
  entertainmentDaysOfWeek: number
  exerciseGapDays: number
  studySlumpRatio: number
  energyDeclinePoints: number
  loggingGapDays: number
  goalOffPaceDays: number
  goalOffPaceProgress: number
}

export type OnboardingState = {
  /** Set when the welcome tour was finished or skipped. */
  tourSeenAt?: string
  /** Set when the getting-started checklist was dismissed by hand. */
  checklistDismissedAt?: string
  /**
   * Set when the user asked for the tour again from Settings. Kept separate
   * from `tourSeenAt` because auto-opening is for first runs only — someone
   * with months of data still has to be able to replay it on demand.
   */
  tourRequestedAt?: string
}

/** Metrics that habits, goals and analytics can address by key. */
export const METRIC_KEYS = [
  'energy',
  'mood',
  'sleep_hours',
  'technical_study_minutes',
  'deep_work_minutes',
  'focus_minutes',
  'exercise_minutes',
  'reading_minutes',
  'reading_pages',
  'entertainment_minutes',
  'english_minutes',
] as const
export type MetricKey = (typeof METRIC_KEYS)[number]

/** A daily row with session-derived values resolved (view `v_daily_effective`). */
export type EffectiveDailyLog = {
  id: string
  logDate: string
  energy: number | null
  mood: number | null
  sleepHours: number | null
  technicalStudyMinutes: number | null
  deepWorkMinutes: number | null
  effectiveStudyMinutes: number | null
  effectiveDeepWorkMinutes: number | null
  exerciseMinutes: number | null
  exerciseType: string | null
  readingMinutes: number | null
  readingPages: number | null
  entertainmentMinutes: number | null
  englishMinutes: number | null
  dailyWin: string | null
  dailyProblem: string | null
  tomorrowPriority: string | null
  note: string | null
  sessionCount: number
}

export type ReviewMetricsSnapshot = {
  computedAt: string
  periodStart: string
  periodEnd: string
  daysLogged: number
  avgEnergy: number | null
  avgMood: number | null
  avgSleepHours: number | null
  totalStudyMinutes: number
  totalDeepWorkMinutes: number
  exerciseDays: number
  totalExerciseMinutes: number
  totalReadingMinutes: number
  totalEntertainmentMinutes: number
  habitCompletionRate: number | null
  periodScore: number | null
  bestDay: { date: string; score: number } | null
  worstDay: { date: string; score: number } | null
}

export type InsightPayload = {
  /** i18n message key under the `insights` namespace. */
  messageKey: string
  /** Values interpolated into the message. Numbers are pre-rounded. */
  values: Record<string, string | number>
  href?: string
  n?: number
}
