import { addDays, isISODate, maxDate, minDate, type ISODate } from '@/lib/dates'
import {
  GOAL_AGGREGATIONS,
  GOAL_CATEGORIES,
  GOAL_DIRECTIONS,
  GOAL_MODES,
  GOAL_PERIODS,
  GOAL_PRIORITIES,
  type GoalAggregation,
  type GoalCategory,
  type GoalDirection,
  type GoalMode,
  type GoalPeriod,
  type GoalPriority,
} from '@/lib/goals/options'
import { METRIC_KEYS, type MetricKey } from '@/lib/types'

/**
 * What a language model returns about a goal, turned into something the goal
 * form can hold. Pure, so every rule that keeps an invented metric or an
 * impossible deadline out of the form is testable without a network.
 *
 * Nothing here writes: the draft lands in a form the user reads and confirms.
 */
export const MAX_MILESTONES = 20

/** A goal may start a year either side of today; further is a typo, not a plan. */
const MAX_START_SHIFT_DAYS = 365

/** Ten years is already beyond what a deadline means here. */
const MAX_HORIZON_DAYS = 3650

/** Exactly the shape asked of the model — loose, because it is untrusted. */
export type ParsedGoal = {
  name?: unknown
  description?: unknown
  category?: unknown
  priority?: unknown
  start_date?: unknown
  target_date?: unknown
  progress_mode?: unknown
  metric_key?: unknown
  metric_aggregation?: unknown
  metric_period?: unknown
  metric_target?: unknown
  metric_direction?: unknown
  milestones?: unknown
}

export type GoalMetricPlan = {
  key: MetricKey
  aggregation: GoalAggregation
  period: GoalPeriod
  target: number
  direction: GoalDirection
}

export type GoalDraft = {
  name: string
  description: string | null
  category: GoalCategory
  priority: GoalPriority
  startDate: ISODate
  targetDate: ISODate | null
  progressMode: GoalMode
  /** Present whenever the model proposed a usable rule, whatever the mode. */
  metric: GoalMetricPlan | null
  milestoneTitles: string[]
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const text = asString(value)
  return text !== null && (allowed as readonly string[]).includes(text) ? (text as T) : fallback
}

function asNumber(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(asString(value) ?? NaN)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function asDate(value: unknown): ISODate | null {
  const text = asString(value)
  return text !== null && isISODate(text) ? text : null
}

function titlesOf(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => asString(entry)?.slice(0, 200))
    .filter((title): title is string => title !== null && title !== undefined)
    .slice(0, MAX_MILESTONES)
}

/**
 * A draft, or null when the note never named a goal — a name is the one field
 * nothing sensible can be invented for.
 */
export function toGoalDraft({
  parsed,
  today,
}: {
  parsed: ParsedGoal
  today: ISODate
}): GoalDraft | null {
  const name = asString(parsed.name)?.slice(0, 200)
  if (!name) return null

  const proposedStart = asDate(parsed.start_date) ?? today
  const startDate = minDate(
    maxDate(proposedStart, addDays(today, -MAX_START_SHIFT_DAYS)),
    addDays(today, MAX_START_SHIFT_DAYS),
  )

  // A deadline before the start is a misread, not a shorter goal: drop it and
  // let the user set one rather than save a row the CHECK would reject.
  const proposedTarget = asDate(parsed.target_date)
  const targetDate =
    proposedTarget && proposedTarget >= startDate
      ? minDate(proposedTarget, addDays(startDate, MAX_HORIZON_DAYS))
      : null

  const metricKey = oneOf<MetricKey | ''>(parsed.metric_key, [...METRIC_KEYS, ''], '')
  const metricTarget = asNumber(parsed.metric_target)
  const metric: GoalMetricPlan | null =
    metricKey !== '' && metricTarget !== null
      ? {
          key: metricKey,
          aggregation: oneOf(parsed.metric_aggregation, GOAL_AGGREGATIONS, 'sum'),
          period: oneOf(parsed.metric_period, GOAL_PERIODS, 'total'),
          target: metricTarget,
          direction: oneOf(parsed.metric_direction, GOAL_DIRECTIONS, 'at_least'),
        }
      : null

  const milestoneTitles = titlesOf(parsed.milestones)

  // The mode has to match what actually came back, or the form opens on an
  // empty metric block and the save is refused for a reason nobody can see.
  let progressMode = oneOf(parsed.progress_mode, GOAL_MODES, 'manual')
  if (progressMode === 'metric' && !metric) progressMode = 'manual'
  if (progressMode === 'milestones' && milestoneTitles.length === 0) progressMode = 'manual'

  return {
    name,
    description: asString(parsed.description)?.slice(0, 2000) ?? null,
    category: oneOf(parsed.category, GOAL_CATEGORIES, 'life'),
    priority: oneOf(parsed.priority, GOAL_PRIORITIES, 'medium'),
    startDate,
    targetDate,
    progressMode,
    metric,
    milestoneTitles,
  }
}
