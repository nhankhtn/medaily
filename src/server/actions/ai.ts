'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { PATHS } from '@/lib/paths'
import { generatePeriodNarrative, NarrativeDisabledError } from '@/server/services/ai'

export type GenerateResult =
  | { ok: true; contentMd: string }
  | { ok: false; error: 'disabled' | 'invalid_input' | 'failed'; detail?: string }

/**
 * Spec 29 — nothing is sent anywhere unless the user configured a key, and the
 * payload is limited to period aggregates plus rule-generated observations.
 */
export async function generateReview(input: unknown): Promise<GenerateResult> {
  const parsed = z
    .object({ period: z.enum(['weekly', 'monthly']), key: z.string().min(4).max(10) })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'invalid_input' }

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
