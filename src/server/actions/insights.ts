'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { addDays, today } from '@/lib/dates'
import { dismissInsight, snoozeInsight } from '@/server/repositories/insights'
import { getDayContext } from '@/server/services/settings'

const idSchema = z.string().uuid()

export async function dismiss(insightId: unknown) {
  await dismissInsight(getCurrentUserId(), idSchema.parse(insightId))
  revalidatePath('/')
  return { ok: true }
}

/** Snoozing hides a card for a week rather than forever (spec 18.4). */
export async function snooze(insightId: unknown) {
  const ctx = await getDayContext()
  await snoozeInsight(getCurrentUserId(), idSchema.parse(insightId), addDays(today(ctx), 7))
  revalidatePath('/')
  return { ok: true }
}
