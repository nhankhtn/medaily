import { addDays, isISODate, maxDate, minDate, type ISODate } from '@/lib/dates'
import { toGoalDraft, type GoalDraft, type ParsedGoal } from '@/lib/goals/draft'
import { GOAL_PRIORITIES, type GoalPriority } from '@/lib/goals/options'

/**
 * A pasted paragraph, turned into the rows the review list shows: goals to
 * pursue and tasks to tick off, in the order they were written.
 *
 * Nothing here is about `day_plans` — that is the calendar's own feature. This
 * is the capture box splitting free text into things worth keeping.
 *
 * Pure, so the rules that decide what survives a model's answer are testable
 * without a network or a database.
 */
export const MAX_PLAN_ITEMS = 15

/** Matches the `estimate_range` CHECK: a week of minutes. */
const MAX_ESTIMATE_MINUTES = 10_080

/** A due date is allowed to be overdue, but not from another era. */
const MAX_OVERDUE_DAYS = 365
const MAX_HORIZON_DAYS = 3650

export type ParsedPlanItem = ParsedGoal & {
  kind?: unknown
  title?: unknown
  due_date?: unknown
  estimate_minutes?: unknown
}

export type PlanTask = {
  title: string
  dueDate: ISODate | null
  priority: GoalPriority
  estimateMinutes: number | null
}

export type PlanItem = { id: string } & (
  { kind: 'goal'; goal: GoalDraft } | { kind: 'task'; task: PlanTask }
)

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function asDate(value: unknown, today: ISODate): ISODate | null {
  const text = asString(value)
  if (text === null || !isISODate(text)) return null
  return minDate(maxDate(text, addDays(today, -MAX_OVERDUE_DAYS)), addDays(today, MAX_HORIZON_DAYS))
}

function asEstimate(value: unknown): number | null {
  const minutes = typeof value === 'number' ? value : Number(asString(value) ?? NaN)
  if (!Number.isFinite(minutes) || minutes <= 0) return null
  return Math.min(MAX_ESTIMATE_MINUTES, Math.round(minutes))
}

function toTask(raw: ParsedPlanItem, today: ISODate): PlanTask | null {
  const title = (asString(raw.title) ?? asString(raw.name))?.slice(0, 300)
  if (!title) return null

  const priority = asString(raw.priority)
  return {
    title,
    dueDate: asDate(raw.due_date ?? raw.target_date, today),
    priority:
      priority !== null && (GOAL_PRIORITIES as readonly string[]).includes(priority)
        ? (priority as GoalPriority)
        : 'medium',
    estimateMinutes: asEstimate(raw.estimate_minutes),
  }
}

export function toPlanItems({
  parsed,
  today,
}: {
  parsed: ParsedPlanItem[]
  today: ISODate
}): PlanItem[] {
  const items: PlanItem[] = []

  for (const raw of parsed.slice(0, MAX_PLAN_ITEMS)) {
    // Stable across re-renders, so a row keeps its edits while others are
    // unticked or removed.
    const id = `item-${items.length}`

    if (raw.kind === 'goal') {
      const goal = toGoalDraft({ parsed: raw, today })
      if (goal) items.push({ id, kind: 'goal', goal })
      continue
    }

    // Anything not clearly a goal is a task: the cheaper mistake, because a
    // task is one line to delete and a goal is a whole record to unpick.
    const task = toTask(raw, today)
    if (task) items.push({ id, kind: 'task', task })
  }

  return items
}
