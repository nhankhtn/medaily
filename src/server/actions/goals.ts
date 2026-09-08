'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { updateGoal, upsertMilestone } from '@/server/repositories/goals'
import { findMilestonesFor } from '@/server/repositories/goals'

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
