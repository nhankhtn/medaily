import { cache } from 'react'
import { getCurrentUserId } from '@/lib/auth/current-user'
import {
  buildChecklist,
  shouldOpenTour,
  shouldShowChecklist,
  type Checklist,
} from '@/lib/onboarding'
import type { OnboardingState } from '@/lib/types'
import { countOnboardingSignals } from '@/server/repositories/onboarding'
import { findSettings } from '@/server/repositories/settings'

export type OnboardingView = {
  checklist: Checklist
  showChecklist: boolean
  openTour: boolean
  /** True when the tour has been seen, so Settings can offer to replay it. */
  tourSeen: boolean
}

export const getOnboardingView = cache(async (): Promise<OnboardingView> => {
  const userId = getCurrentUserId()

  const [signals, settings] = await Promise.all([
    countOnboardingSignals(userId),
    findSettings(userId),
  ])

  const state: OnboardingState | null = settings?.onboarding ?? null
  const checklist = buildChecklist(signals)

  return {
    checklist,
    showChecklist: shouldShowChecklist(checklist, state),
    openTour: shouldOpenTour(signals, state),
    tourSeen: Boolean(state?.tourSeenAt),
  }
})
