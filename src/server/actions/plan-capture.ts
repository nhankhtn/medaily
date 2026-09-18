'use server'

import { z } from 'zod'
import { log } from '@/lib/log'
import { MAX_PLAN_ITEMS, type PlanItem } from '@/lib/capture/plan-items'
import { today as todayOf, type ISODate } from '@/lib/dates'
import type { BindableMetric } from '@/lib/metrics/bindable'
import { MAX_MILESTONES } from '@/lib/goals/draft'
import {
  GOAL_AGGREGATIONS,
  GOAL_CATEGORIES,
  GOAL_DIRECTIONS,
  GOAL_MODES,
  GOAL_PERIODS,
  GOAL_PRIORITIES,
} from '@/lib/goals/options'
import { isoDateSchema } from '@/lib/validation/daily'
import { saveGoal } from '@/server/actions/goals'
import { saveTask } from '@/server/actions/projects'
import { geminiEnabled } from '@/server/services/gemini'
import { bindableMetrics, canBindMetric } from '@/server/services/metrics'
import { parsePlan } from '@/server/services/plan-capture'
import { dayContextOf, getSettings } from '@/server/services/settings'
import { createLimit } from '@/lib/rate-limit'

/**
 * Free text in, goals and tasks out.
 *
 * Reading and saving are separate calls on purpose: the model only fills the
 * list in, and the save below is the user pressing a button on rows they have
 * seen. It writes through `saveGoal` and `saveTask`, so a captured row goes
 * through exactly the validation a hand-typed one does.
 *
 * Ten notes a minute, as with the finance capture box.
 */
const captures = createLimit({ capacity: 10, refillMs: 60 * 1000 })

export type ParsePlanResult =
  /**
   * `today` travels with the rows: the list needs it to turn one into a goal.
   * `metrics` travels with them so a goal row can be pointed at a metric this
   * person added themselves, which the model never proposes.
   */
  | { ok: true; items: PlanItem[]; today: ISODate; metrics: BindableMetric[] }
  | { ok: false; error: 'disabled' | 'invalid_input' | 'rate_limited' | 'failed' }

export async function parsePlanText(input: unknown): Promise<ParsePlanResult> {
  if (!geminiEnabled()) return { ok: false, error: 'disabled' }

  const parsed = z.object({ text: z.string().trim().min(3).max(2000) }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const settings = await getSettings()
  if (!captures.take(settings.userId).allowed) return { ok: false, error: 'rate_limited' }

  const today = todayOf(dayContextOf(settings))

  try {
    const [items, metrics] = await Promise.all([
      parsePlan({ text: parsed.data.text, today }),
      bindableMetrics(settings.userId),
    ])
    return { ok: true, items, today, metrics }
  } catch (error) {
    await log.error('capture', 'could not read that note', error)
    return { ok: false, error: 'failed' }
  }
}

const goalRow = z.object({
  kind: z.literal('goal'),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  category: z.enum(GOAL_CATEGORIES),
  priority: z.enum(GOAL_PRIORITIES),
  startDate: isoDateSchema,
  targetDate: isoDateSchema.nullable(),
  progressMode: z.enum(GOAL_MODES),
  metric: z
    .object({
      key: z.string().min(1).max(40),
      aggregation: z.enum(GOAL_AGGREGATIONS),
      period: z.enum(GOAL_PERIODS),
      target: z.number().positive(),
      direction: z.enum(GOAL_DIRECTIONS),
    })
    .nullable(),
  milestoneTitles: z.array(z.string().min(1).max(200)).max(MAX_MILESTONES),
})

const taskRow = z.object({
  kind: z.literal('task'),
  title: z.string().min(1).max(300),
  dueDate: isoDateSchema.nullable(),
  priority: z.enum(GOAL_PRIORITIES),
  estimateMinutes: z.number().int().min(0).max(10_080).nullable(),
})

export type SavePlanResult =
  { ok: true; goals: number; tasks: number; failed: number } | { ok: false; error: 'invalid_input' }

export async function savePlan(input: unknown): Promise<SavePlanResult> {
  const parsed = z
    .object({
      rows: z
        .array(z.discriminatedUnion('kind', [goalRow, taskRow]))
        .min(1)
        .max(MAX_PLAN_ITEMS),
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  const settings = await getSettings()

  let goals = 0
  let tasks = 0
  let failed = 0

  // One at a time, and a row that is refused does not take the others with it:
  // the list stays on screen, so anything that failed is still there to fix.
  for (const row of parsed.data.rows) {
    if (row.kind === 'goal') {
      const isMetric = row.progressMode === 'metric'

      // `saveGoal` checks this too; doing it here keeps the row on the list as
      // a failure the user can fix rather than a silent drop.
      if (isMetric && row.metric && !(await canBindMetric(settings.userId, row.metric.key))) {
        failed += 1
        continue
      }
      const result = await saveGoal({
        name: row.name,
        description: row.description ?? '',
        category: row.category,
        status: 'active',
        priority: row.priority,
        startDate: row.startDate,
        targetDate: row.targetDate,
        progressMode: row.progressMode,
        progressManual: row.progressMode === 'manual' ? 0 : null,
        metricKey: isMetric ? (row.metric?.key ?? null) : null,
        metricAggregation: isMetric ? (row.metric?.aggregation ?? null) : null,
        metricPeriod: isMetric ? (row.metric?.period ?? null) : null,
        metricTarget: isMetric ? (row.metric?.target ?? null) : null,
        metricDirection: isMetric ? (row.metric?.direction ?? null) : null,
        milestoneTitles: row.progressMode === 'milestones' ? row.milestoneTitles : undefined,
      })
      if (result.ok) goals += 1
      else failed += 1
      continue
    }

    const result = await saveTask({
      title: row.title,
      projectId: null,
      status: 'todo',
      priority: row.priority,
      dueDate: row.dueDate,
      estimateMinutes: row.estimateMinutes,
    })
    if (result.ok) tasks += 1
    else failed += 1
  }

  return { ok: true, goals, tasks, failed }
}
