'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { upsertReview } from '@/server/repositories/reviews'
import { computeMetrics, rangeOf, SNAPSHOT_VERSION } from '@/server/services/reviews'
import { today as todayOf } from '@/lib/dates'
import { dayContextOf, getSettings } from '@/server/services/settings'

const periodSchema = z.enum(['weekly', 'monthly', 'yearly'])
const optionalText = z
  .string()
  .max(8000)
  .transform((value) => (value.trim() === '' ? null : value.trim()))
  .nullable()
  .optional()

const reviewSchema = z.object({
  period: periodSchema,
  key: z.string().min(4).max(10),
  whatWorked: optionalText,
  whatDidnt: optionalText,
  changeNext: optionalText,
  topPriority: optionalText,
  reflection: optionalText,
})

export async function saveReview(input: unknown) {
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const { period, key, ...values } = parsed.data
  await upsertReview(getCurrentUserId(), period, key, values)

  revalidatePath('/reviews')
  return { ok: true as const }
}

/**
 * Finalizing freezes the computed block into the row, so re-reading the review
 * later shows the numbers it was written against (spec 17.3).
 */
export async function finalizeReview(input: unknown) {
  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  const settings = await getSettings()
  const { period, key, ...values } = parsed.data
  const metrics = await computeMetrics(rangeOf(period, key), todayOf(dayContextOf(settings)))

  await upsertReview(settings.userId, period, key, {
    ...values,
    metricsSnapshot: metrics,
    snapshotVersion: SNAPSHOT_VERSION,
    finalizedAt: new Date(),
  })

  revalidatePath('/reviews')
  revalidatePath('/')
  return { ok: true as const }
}

/** For when history was edited after a review was finalized. */
export async function recomputeReviewSnapshot(input: unknown) {
  const parsed = z.object({ period: periodSchema, key: z.string().min(4).max(10) }).safeParse(input)
  if (!parsed.success) return { ok: false as const }

  const settings = await getSettings()
  const metrics = await computeMetrics(
    rangeOf(parsed.data.period, parsed.data.key),
    todayOf(dayContextOf(settings)),
  )

  await upsertReview(settings.userId, parsed.data.period, parsed.data.key, {
    metricsSnapshot: metrics,
    snapshotVersion: SNAPSHOT_VERSION,
  })

  revalidatePath('/reviews')
  return { ok: true as const }
}

export async function reopenReview(input: unknown) {
  const parsed = z.object({ period: periodSchema, key: z.string().min(4).max(10) }).safeParse(input)
  if (!parsed.success) return { ok: false as const }

  await upsertReview(getCurrentUserId(), parsed.data.period, parsed.data.key, {
    finalizedAt: null,
  })
  revalidatePath('/reviews')
  return { ok: true as const }
}
