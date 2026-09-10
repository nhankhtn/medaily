import { cache } from 'react'
import { getCurrentUserId, UnauthenticatedError } from '@/lib/auth/current-user'
import type { DayContext } from '@/lib/dates'
import {
  DEFAULT_INSIGHT_THRESHOLDS,
  DEFAULT_SCORE_TARGETS,
  DEFAULT_SCORE_WEIGHTS,
  DEFAULT_STREAK_THRESHOLDS,
} from '@/lib/defaults'
import type {
  InsightThresholds,
  ScoreTargets,
  ScoreWeights,
  StreakThresholds,
} from '@/lib/types'
import { findUserById } from '@/server/repositories/auth'
import { findSettings, insertUserSettings } from '@/server/repositories/settings'

/**
 * A user with no settings row is repaired; a settings row for a user that no
 * longer exists is not. Recreating the user here would mean a still-valid
 * cookie could resurrect a deleted account on its next request.
 */
async function settingsForKnownUser(userId: string) {
  if (!(await findUserById(userId))) throw new UnknownUserError(userId)
  return insertUserSettings(userId)
}

export class UnknownUserError extends Error {
  constructor(readonly userId: string) {
    super(`session names a user that does not exist: ${userId}`)
    this.name = 'UnknownUserError'
  }
}

export type ResolvedSettings = {
  userId: string
  locale: 'en' | 'vi'
  timezone: string
  dayRolloverHour: number
  weekStart: 'monday' | 'sunday'
  theme: 'light' | 'dark' | 'system'
  density: string
  accent: string
  unitSystem: 'metric' | 'imperial'
  defaultCurrency: string
  scoreWeights: ScoreWeights
  scoreTargets: ScoreTargets
  streakThresholds: StreakThresholds
  streakGraceEnabled: boolean
  insightThresholds: InsightThresholds
  reminderTime: string
  dashboardCards: string[] | null
}

/**
 * Settings are read once per request. Stored JSONB columns are merged over the
 * defaults so a partially written blob can never produce an undefined target.
 */
export const getSettings = cache(async (): Promise<ResolvedSettings> => {
  const userId = await getCurrentUserId()
  const row = (await findSettings(userId)) ?? (await settingsForKnownUser(userId))

  return {
    userId,
    locale: row.locale,
    timezone: row.timezone,
    dayRolloverHour: row.dayRolloverHour,
    weekStart: row.weekStart,
    theme: row.theme,
    density: row.density,
    accent: row.accent,
    unitSystem: row.unitSystem,
    defaultCurrency: row.defaultCurrency,
    scoreWeights: { ...DEFAULT_SCORE_WEIGHTS, ...(row.scoreWeights ?? {}) },
    scoreTargets: { ...DEFAULT_SCORE_TARGETS, ...(row.scoreTargets ?? {}) },
    streakThresholds: { ...DEFAULT_STREAK_THRESHOLDS, ...(row.streakThresholds ?? {}) },
    streakGraceEnabled: row.streakGraceEnabled,
    insightThresholds: { ...DEFAULT_INSIGHT_THRESHOLDS, ...(row.insightThresholds ?? {}) },
    reminderTime: row.reminderTime,
    dashboardCards: row.dashboardCards ?? null,
  }
})

export function dayContextOf(settings: ResolvedSettings): DayContext {
  return {
    timezone: settings.timezone,
    dayRolloverHour: settings.dayRolloverHour,
    weekStart: settings.weekStart,
  }
}

export const getDayContext = cache(async (): Promise<DayContext> => dayContextOf(await getSettings()))

/** Defaults used when the database cannot be reached (see `getShellSettings`). */
const FALLBACK_SETTINGS: ResolvedSettings = {
  userId: '',
  locale: 'en',
  timezone: 'Asia/Ho_Chi_Minh',
  dayRolloverHour: 4,
  weekStart: 'monday',
  theme: 'system',
  density: 'comfortable',
  accent: 'indigo',
  unitSystem: 'metric',
  defaultCurrency: 'VND',
  scoreWeights: DEFAULT_SCORE_WEIGHTS,
  scoreTargets: DEFAULT_SCORE_TARGETS,
  streakThresholds: DEFAULT_STREAK_THRESHOLDS,
  streakGraceEnabled: true,
  insightThresholds: DEFAULT_INSIGHT_THRESHOLDS,
  reminderTime: '21:00',
  dashboardCards: null,
}

/**
 * Settings for the shell only — the root layout and the sign-in page.
 *
 * Those two must render even when the database is unreachable: a layout that
 * throws takes the whole document with it, and the resulting Server Components
 * error says nothing a reader can act on. Data pages keep using `getSettings`,
 * which still fails loudly, and `/api/health` reports the real cause.
 */
export const getShellSettings = cache(async (): Promise<ResolvedSettings> => {
  try {
    return await getSettings()
  } catch (error) {
    if (!(error instanceof UnauthenticatedError)) {
      console.error('[settings] falling back to defaults:', error)
    }
    return FALLBACK_SETTINGS
  }
})
