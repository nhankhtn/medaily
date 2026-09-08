import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
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
import { findSettings, insertDefaultSettings } from '@/server/repositories/settings'

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
  const userId = getCurrentUserId()
  const row = (await findSettings(userId)) ?? (await insertDefaultSettings(userId))

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
