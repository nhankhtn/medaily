'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { PATHS } from '@/lib/paths'
import { createLimit } from '@/lib/rate-limit'
import { generatePeriodNarrative, NarrativeDisabledError } from '@/server/services/ai'

export type GenerateResult =
  | { ok: true; contentMd: string }
  | { ok: false; error: 'disabled' | 'invalid_input' | 'rate_limited' | 'failed'; detail?: string }

/**
 * Tighter than the rest of them, because this one is the most expensive thing
 * the app asks for: a page of prose over two periods of aggregates, where the
 * others read one sentence. It is also the least repeated — a review is
 * written once a week, and three tries a minute is already generous for
 * "that reads wrong, do it again".
 */
const narratives = createLimit({ capacity: 3, refillMs: 60 * 1000 })

/**
 * Spec 29 — nothing is sent anywhere unless the user configured a key, and the
 * payload is limited to period aggregates plus rule-generated observations.
 */
export async function generateReview(input: unknown): Promise<GenerateResult> {
  const parsed = z
    .object({ period: z.enum(['weekly', 'monthly']), key: z.string().min(4).max(10) })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

  // The cookie names the user, so the limit is checked before any read.
  const userId = await getCurrentUserId()
  if (!narratives.take(userId).allowed) return { ok: false, error: 'rate_limited' }

  try {
    const contentMd = await generatePeriodNarrative(parsed.data.period, parsed.data.key)
    revalidatePath(PATHS.reviews)
    return { ok: true, contentMd }
  } catch (error) {
    if (error instanceof NarrativeDisabledError) return { ok: false, error: 'disabled' }
    return {
      ok: false,
      error: 'failed',
      detail: error instanceof Error ? error.message : undefined,
    }
  }
}
