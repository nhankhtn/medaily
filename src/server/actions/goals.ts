'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { METRIC_KEYS } from '@/lib/types'
import { isoDateSchema } from '@/lib/validation/daily'
import {
  findMilestonesFor,
  insertGoal,
  updateGoal,
  upsertMilestone,
} from '@/server/repositories/goals'

export async function setManualProgress(input: unknown) {
  const { goalId, percent } = z
    .object({ goalId: z.string().uuid(), percent: z.number().min(0).max(100) })
    .parse(input)

  await updateGoal(getCurrentUserId(), goalId, {
    progressManual: String(percent),
    progressUpdatedAt: new Date(),
  })
  revalidatePath('/goals')
  revalidatePath('/')
  return { ok: true }
}

/** Toggling the last milestone is where a goal usually finishes, so say so. */
export async function toggleMilestone(input: unknown) {
  const { goalId, milestoneId } = z
    .object({ goalId: z.string().uuid(), milestoneId: z.string().uuid() })
    .parse(input)

  const milestones = await findMilestonesFor([goalId])
  const target = milestones.find((milestone) => milestone.id === milestoneId)
  if (!target) return { ok: false as const, error: 'not_found' as const }

  await upsertMilestone({
    id: target.id,
    goalId,
    title: target.title,
    completedAt: target.completedAt ? null : new Date(),
    weight: target.weight,
    sortOrder: target.sortOrder,
    dueDate: target.dueDate,
  })

  const remaining = milestones.filter(
    (milestone) =>
      milestone.id !== target.id ? milestone.completedAt === null : target.completedAt !== null,
  )

  revalidatePath('/goals')
  revalidatePath('/')
  return { ok: true as const, allComplete: remaining.length === 0 }
}

export async function updateGoalStatus(input: unknown) {
  const { goalId, status } = z
    .object({
      goalId: z.string().uuid(),
      status: z.enum(['active', 'completed', 'paused', 'cancelled']),
    })
    .parse(input)

  await updateGoal(getCurrentUserId(), goalId, {
    status,
    completedAt: status === 'completed' ? new Date() : null,
  })
  revalidatePath('/goals')
  revalidatePath('/')
  return { ok: true }
}


const goalSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(200),
    description: z
      .string()
      .max(2000)
      .transform((value) => (value.trim() === '' ? null : value.trim()))
      .nullable()
      .optional(),
    category: z.enum(['career', 'health', 'finance', 'knowledge', 'life']).default('life'),
    status: z.enum(['active', 'completed', 'paused', 'cancelled']).default('active'),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    startDate: isoDateSchema,
    targetDate: isoDateSchema.nullable().optional(),
    progressMode: z.enum(['manual', 'metric', 'milestones']).default('manual'),
    progressManual: z.number().min(0).max(100).nullable().optional(),
    metricKey: z.enum(METRIC_KEYS).nullable().optional(),
    metricAggregation: z.enum(['sum', 'avg', 'count_days', 'latest']).nullable().optional(),
    metricPeriod: z.enum(['total', 'weekly', 'monthly']).nullable().optional(),
    metricTarget: z.number().positive().nullable().optional(),
    metricDirection: z.enum(['at_least', 'at_most']).nullable().optional(),
    milestoneTitles: z.array(z.string().min(1).max(200)).max(20).optional(),
  })
  // Mirrors the `metric_mode_complete` CHECK constraint, with a readable message.
  .refine(
    (value) =>
      value.progressMode !== 'metric' ||
      (value.metricKey && value.metricAggregation && value.metricPeriod && value.metricTarget),
    { message: 'a metric goal needs a metric, an aggregation, a period and a target', path: ['metricTarget'] },
  )
  .refine((value) => !value.targetDate || value.targetDate >= value.startDate, {
    message: 'the target date cannot be before the start date',
    path: ['targetDate'],
  })

export type SaveGoalResult =
  | { ok: true; id: string }
  | { ok: false; error: 'invalid_input'; detail?: string }

export async function saveGoal(input: unknown): Promise<SaveGoalResult> {
  const parsed = goalSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: 'invalid_input', detail: parsed.error.issues[0]?.message }
  }

  const userId = getCurrentUserId()
  const { id, milestoneTitles, ...values } = parsed.data
  const isMetric = values.progressMode === 'metric'

  const row = {
    ...values,
    description: values.description ?? null,
    targetDate: values.targetDate ?? null,
    // Only the chosen mode's columns are written, so a mode switch cannot leave
    // stale configuration behind that the CHECK constraint would then reject.
    progressManual:
      values.progressMode === 'manual' && values.progressManual !== null && values.progressManual !== undefined
        ? String(values.progressManual)
        : null,
    progressUpdatedAt: values.progressMode === 'manual' ? new Date() : null,
    metricKey: isMetric ? (values.metricKey ?? null) : null,
    metricAggregation: isMetric ? (values.metricAggregation ?? null) : null,
    metricPeriod: isMetric ? (values.metricPeriod ?? null) : null,
    metricTarget: isMetric && values.metricTarget ? String(values.metricTarget) : null,
    metricDirection: isMetric ? (values.metricDirection ?? 'at_least') : null,
    completedAt: values.status === 'completed' ? new Date() : null,
  }

  const goal = id ? await updateGoal(userId, id, row) : await insertGoal({ ...row, userId })

  if (values.progressMode === 'milestones' && milestoneTitles?.length) {
    const existing = await findMilestonesFor([goal.id])
    for (const [index, title] of milestoneTitles.entries()) {
      const current = existing[index]
      await upsertMilestone({
        id: current?.id,
        goalId: goal.id,
        title,
        sortOrder: index,
        weight: current?.weight ?? '1',
        completedAt: current?.completedAt ?? null,
        dueDate: current?.dueDate ?? null,
      })
    }
  }

  revalidatePath('/goals')
  revalidatePath('/')
  return { ok: true, id: goal.id }
}

export async function archiveGoal(input: unknown) {
  const id = z.string().uuid().parse(input)
  await updateGoal(getCurrentUserId(), id, { archivedAt: new Date() })
  revalidatePath('/goals')
  revalidatePath('/')
  return { ok: true }
}
