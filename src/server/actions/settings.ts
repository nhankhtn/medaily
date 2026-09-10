'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/auth/current-user'
import { LOCALE_COOKIE, LOCALES } from '@/i18n/config'
import { DEFAULT_SCORE_TARGETS, DEFAULT_SCORE_WEIGHTS } from '@/lib/defaults'
import { weightsAreValid } from '@/lib/scoring'
import { SCORE_COMPONENTS } from '@/lib/types'
import { updateSettings } from '@/server/repositories/settings'

const COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
} as const

/**
 * Locale lives in settings and is mirrored to a cookie so the next server
 * render is already correct without a URL prefix (spec 21).
 */
export async function setLocale(locale: string) {
  const parsed = z.enum(LOCALES).parse(locale)
  await updateSettings(await getCurrentUserId(), { locale: parsed })
  ;(await cookies()).set(LOCALE_COOKIE, parsed, COOKIE_OPTIONS)
  revalidatePath('/', 'layout')
}

export async function setTheme(theme: string) {
  const parsed = z.enum(['light', 'dark', 'system']).parse(theme)
  await updateSettings(await getCurrentUserId(), { theme: parsed })
  revalidatePath('/', 'layout')
}

const settingsSchema = z.object({
  timezone: z.string().min(1).optional(),
  dayRolloverHour: z.number().int().min(0).max(8).optional(),
  weekStart: z.enum(['monday', 'sunday']).optional(),
  density: z.enum(['comfortable', 'compact']).optional(),
  streakGraceEnabled: z.boolean().optional(),
  unitSystem: z.enum(['metric', 'imperial']).optional(),
  defaultCurrency: z.string().length(3).optional(),
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  scoreWeights: z.record(z.enum(SCORE_COMPONENTS), z.number().min(0).max(100)).optional(),
})

export async function updateUserSettings(input: unknown) {
  const patch = settingsSchema.parse(input)

  if (patch.scoreWeights) {
    const merged = { ...DEFAULT_SCORE_WEIGHTS, ...patch.scoreWeights }
    if (!weightsAreValid(merged)) {
      return { ok: false as const, error: 'weights_must_sum_to_100' }
    }
    await updateSettings(await getCurrentUserId(), { ...patch, scoreWeights: merged })
  } else {
    await updateSettings(await getCurrentUserId(), patch)
  }

  revalidatePath('/', 'layout')
  return { ok: true as const }
}

export async function resetScoreDefaults() {
  await updateSettings(await getCurrentUserId(), {
    scoreWeights: DEFAULT_SCORE_WEIGHTS,
    scoreTargets: DEFAULT_SCORE_TARGETS,
  })
  revalidatePath('/', 'layout')
}
