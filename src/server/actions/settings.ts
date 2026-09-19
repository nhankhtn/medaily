'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { getCurrentUserId, readSession } from '@/lib/auth/current-user'
import { LOCALE_COOKIE, LOCALES } from '@/i18n/config'
import { parseHiddenFields } from '@/lib/daily/hidden-fields'
import { DEFAULT_SCORE_TARGETS, DEFAULT_SCORE_WEIGHTS } from '@/lib/defaults'
import { PATHS } from '@/lib/paths'
import { weightsAreValid } from '@/lib/scoring'
import { SCORE_COMPONENTS } from '@/lib/types'
import { updateSettings } from '@/server/repositories/settings'
import { isThemePreference, THEME_COOKIE } from '@/lib/themes'

const COOKIE_OPTIONS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
} as const

/**
 * Locale lives in settings and is mirrored to a cookie so the next server
 * render is already correct without a URL prefix (spec 21).
 *
 * The switcher also sits on the sign-in page, where there is no session and
 * so no settings row to write to. Reading the page in your own language is a
 * device preference before it is an account preference: the cookie carries it
 * on its own until someone signs in, and the row catches up from then on.
 */
export async function setLocale(locale: string) {
  const parsed = z.enum(LOCALES).parse(locale)

  const session = await readSession()
  if (session) await updateSettings(session.uid, { locale: parsed })

  ;(await cookies()).set(LOCALE_COOKIE, parsed, COOKIE_OPTIONS)
  revalidatePath(PATHS.home, 'layout')
}

/** Same shape as `setLocale`, and for the same reason — see its comment. */
export async function setTheme(theme: string) {
  // Validated against the theme registry, so a new theme needs no change here.
  const parsed = z.string().refine(isThemePreference).parse(theme)

  const session = await readSession()
  if (session) await updateSettings(session.uid, { theme: parsed })

  ;(await cookies()).set(THEME_COOKIE, parsed, COOKIE_OPTIONS)
  revalidatePath(PATHS.home, 'layout')
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

  revalidatePath(PATHS.home, 'layout')
  return { ok: true as const }
}

/**
 * Which questions the daily log stops asking. Whole list every time rather
 * than a toggle per field: the panel already knows the answer for all of
 * them, and a patch per checkbox would let two quick clicks race.
 */
export async function saveHiddenDailyFields(input: unknown) {
  const parsed = z.object({ fields: z.array(z.string()).max(50) }).safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'invalid_input' as const }

  await updateSettings(await getCurrentUserId(), {
    hiddenDailyFields: parseHiddenFields(parsed.data.fields),
  })

  revalidatePath(PATHS.daily)
  revalidatePath(PATHS.catchUp)
  revalidatePath(PATHS.settings)
  return { ok: true as const }
}

export async function resetScoreDefaults() {
  await updateSettings(await getCurrentUserId(), {
    scoreWeights: DEFAULT_SCORE_WEIGHTS,
    scoreTargets: DEFAULT_SCORE_TARGETS,
  })
  revalidatePath(PATHS.home, 'layout')
}
