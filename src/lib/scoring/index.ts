import { DEFAULT_SCORE_TARGETS, DEFAULT_SCORE_WEIGHTS, WEEK_SCORE_MIN_COVERAGE } from '@/lib/defaults'
import type { ScoreComponent, ScoreTargets, ScoreWeights } from '@/lib/types'

export type ScoreInput = {
  studyMinutes: number | null
  deepWorkMinutes: number | null
  sleepHours: number | null
  exerciseMinutes: number | null
  readingMinutes: number | null
  entertainmentMinutes: number | null
  /** Null when nothing was scheduled — the component is dropped, not zeroed. */
  habitsScheduled: number | null
  habitsCompleted: number | null
  /** Exercise days in the trailing 7 days, for rest-day credit. */
  exerciseDaysLast7?: number
}

export type ComponentResult = {
  component: ScoreComponent
  /** Normalized 0..1, or null when the component has no data for this day. */
  value: number | null
  weight: number
  /** Points contributed to the final 0..100 score. */
  points: number
  /** Raw inputs, for the transparency breakdown (spec 19.5). */
  detail: Record<string, number | null | boolean>
}

export type DayScore = {
  /** 0..100, or null when no component had data. */
  score: number | null
  components: ComponentResult[]
  /** How many components contributed — shown next to the score. */
  componentsUsed: number
  weightUsed: number
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Spec 19.2 — piecewise sleep curve. Oversleeping is mildly penalized, never zeroed. */
export function sleepScore(hours: number, t: ScoreTargets = DEFAULT_SCORE_TARGETS): number {
  const { sleepIdealMin: lo, sleepIdealMax: hi } = t
  const rampStart = lo - 3
  if (hours < rampStart) return 0
  if (hours < lo) return clamp01((hours - rampStart) / 3)
  if (hours <= hi) return 1
  if (hours <= hi + 3) return clamp01(1 - (0.4 * (hours - hi)) / 3)
  return 0.6
}

export function focusScore(
  studyMinutes: number,
  deepWorkMinutes: number,
  t: ScoreTargets = DEFAULT_SCORE_TARGETS,
): number {
  const study = clamp01(studyMinutes / t.studyMinutes)
  const deep = clamp01(deepWorkMinutes / t.deepWorkMinutes)
  return 0.5 * study + 0.5 * deep
}

export function exerciseScore(
  minutes: number,
  t: ScoreTargets = DEFAULT_SCORE_TARGETS,
  exerciseDaysLast7 = 0,
): number {
  if (minutes >= t.exerciseFullMinutes) return 1
  if (minutes >= t.exercisePartialMinutes) return 0.7
  if (minutes >= 1) return 0.4
  // Rest-day credit: rest is part of training (spec 19.2).
  if (t.restDayCreditEnabled && exerciseDaysLast7 >= t.restDayExerciseDays) return 0.7
  return 0
}

export function readingScore(minutes: number, t: ScoreTargets = DEFAULT_SCORE_TARGETS): number {
  return clamp01(minutes / t.readingMinutes)
}

export function entertainmentScore(
  minutes: number,
  t: ScoreTargets = DEFAULT_SCORE_TARGETS,
): number {
  const { entertainmentFreeMinutes: free, entertainmentZeroMinutes: zero } = t
  if (minutes <= free) return 1
  if (minutes >= zero) return 0
  return clamp01(1 - (minutes - free) / (zero - free))
}

export function habitsScore(completed: number, scheduled: number): number | null {
  if (scheduled <= 0) return null
  return clamp01(completed / scheduled)
}

/**
 * Spec 19.3 — components with no data are dropped from both numerator and
 * denominator, so a partially logged day is scored on what exists rather than
 * being punished for the fields it is missing.
 */
export function computeDayScore(
  input: ScoreInput,
  weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS,
  targets: ScoreTargets = DEFAULT_SCORE_TARGETS,
): DayScore {
  const components: ComponentResult[] = []

  const push = (
    component: ScoreComponent,
    value: number | null,
    detail: Record<string, number | null | boolean>,
  ) => {
    components.push({ component, value, weight: weights[component], points: 0, detail })
  }

  const hasFocus = input.studyMinutes !== null || input.deepWorkMinutes !== null
  push(
    'focus',
    hasFocus ? focusScore(input.studyMinutes ?? 0, input.deepWorkMinutes ?? 0, targets) : null,
    {
      studyMinutes: input.studyMinutes,
      deepWorkMinutes: input.deepWorkMinutes,
      studyTarget: targets.studyMinutes,
      deepWorkTarget: targets.deepWorkMinutes,
    },
  )

  push('sleep', input.sleepHours !== null ? sleepScore(input.sleepHours, targets) : null, {
    sleepHours: input.sleepHours,
    idealMin: targets.sleepIdealMin,
    idealMax: targets.sleepIdealMax,
  })

  const restCredit =
    targets.restDayCreditEnabled &&
    (input.exerciseMinutes ?? 0) === 0 &&
    (input.exerciseDaysLast7 ?? 0) >= targets.restDayExerciseDays
  push(
    'exercise',
    input.exerciseMinutes !== null
      ? exerciseScore(input.exerciseMinutes, targets, input.exerciseDaysLast7 ?? 0)
      : null,
    {
      exerciseMinutes: input.exerciseMinutes,
      exerciseDaysLast7: input.exerciseDaysLast7 ?? null,
      restDayCredit: restCredit,
    },
  )

  push(
    'habits',
    input.habitsScheduled !== null && input.habitsCompleted !== null
      ? habitsScore(input.habitsCompleted, input.habitsScheduled)
      : null,
    { completed: input.habitsCompleted, scheduled: input.habitsScheduled },
  )

  push('reading', input.readingMinutes !== null ? readingScore(input.readingMinutes, targets) : null, {
    readingMinutes: input.readingMinutes,
    target: targets.readingMinutes,
  })

  push(
    'entertainment',
    input.entertainmentMinutes !== null
      ? entertainmentScore(input.entertainmentMinutes, targets)
      : null,
    {
      entertainmentMinutes: input.entertainmentMinutes,
      freeMinutes: targets.entertainmentFreeMinutes,
      zeroMinutes: targets.entertainmentZeroMinutes,
    },
  )

  const present = components.filter((c) => c.value !== null)
  const weightUsed = present.reduce((sum, c) => sum + c.weight, 0)

  if (present.length === 0 || weightUsed === 0) {
    return { score: null, components, componentsUsed: 0, weightUsed: 0 }
  }

  let total = 0
  for (const c of components) {
    if (c.value === null) continue
    c.points = round2((100 * (c.weight * c.value)) / weightUsed)
    total += c.weight * c.value
  }

  return {
    score: round2((100 * total) / weightUsed),
    components,
    componentsUsed: present.length,
    weightUsed,
  }
}

export type PeriodScore = {
  /** Withheld (null) when coverage is too low to be meaningful (spec 19.4). */
  score: number | null
  daysLogged: number
  daysInPeriod: number
  coverageMet: boolean
  minCoverage: number
}

/**
 * Period scores average the *logged* days only. Missing days are never zeros —
 * coverage is reported instead, and a thin period withholds the number.
 */
export function computePeriodScore(
  dayScores: (number | null)[],
  daysInPeriod: number,
  minCoverage = WEEK_SCORE_MIN_COVERAGE,
): PeriodScore {
  const scored = dayScores.filter((s): s is number => s !== null)
  const coverageMet = scored.length >= minCoverage
  const mean = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null
  return {
    score: coverageMet && mean !== null ? round2(mean) : null,
    daysLogged: scored.length,
    daysInPeriod,
    coverageMet,
    minCoverage,
  }
}

export function normalizeWeights(weights: ScoreWeights): ScoreWeights {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  if (total === 0) return DEFAULT_SCORE_WEIGHTS
  const scaled = Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, round2((v / total) * 100)]),
  )
  return scaled as ScoreWeights
}

export function weightsAreValid(weights: ScoreWeights): boolean {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  return Math.abs(total - 100) < 0.01 && Object.values(weights).every((w) => w >= 0)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
