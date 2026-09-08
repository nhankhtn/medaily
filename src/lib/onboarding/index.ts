/**
 * Onboarding is two things, deliberately separate:
 *
 * - a **tour** that names each area once, so a new user knows what exists;
 * - a **checklist** that reports real progress, so they know what to do next.
 *
 * Only "saw the tour" and "dismissed the checklist" are stored. Whether a step
 * is done is derived from the data every time, so the checklist can never
 * claim something the database does not actually contain (spec 38.4).
 */

export const TOUR_STEPS = [
  { key: 'log', href: '/daily' },
  { key: 'dashboard', href: '/' },
  { key: 'habitsGoals', href: '/habits' },
  { key: 'insight', href: '/analytics' },
  { key: 'life', href: '/finance' },
  { key: 'settings', href: '/settings' },
] as const

export type TourStepKey = (typeof TOUR_STEPS)[number]['key']

export const CHECKLIST_STEPS = [
  { key: 'log', href: '/daily', target: 1, signal: 'dailyLogCount' },
  { key: 'habit', href: '/habits', target: 1, signal: 'habitCount' },
  { key: 'goal', href: '/goals', target: 1, signal: 'goalCount' },
  // Three days is the point at which a trend line stops being a single dot.
  { key: 'trends', href: '/daily', target: 3, signal: 'dailyLogCount' },
  { key: 'review', href: '/reviews', target: 1, signal: 'reviewCount' },
] as const

export type ChecklistStepKey = (typeof CHECKLIST_STEPS)[number]['key']

export type OnboardingSignals = {
  dailyLogCount: number
  habitCount: number
  goalCount: number
  reviewCount: number
}

export type ChecklistStep = {
  key: ChecklistStepKey
  href: string
  done: boolean
  /** Current count and the count that completes the step, for "1 of 3". */
  current: number
  target: number
}

export type Checklist = {
  steps: ChecklistStep[]
  completedCount: number
  total: number
  allDone: boolean
  /** The first unfinished step — the answer to "where do I start?". */
  nextStep: ChecklistStep | null
}

export function buildChecklist(signals: OnboardingSignals): Checklist {
  const steps: ChecklistStep[] = CHECKLIST_STEPS.map((step) => {
    const current = signals[step.signal]
    return {
      key: step.key,
      href: step.href,
      done: current >= step.target,
      // Never report more than the target, so "3 of 3" cannot read "7 of 3".
      current: Math.min(current, step.target),
      target: step.target,
    }
  })

  const completedCount = steps.filter((step) => step.done).length

  return {
    steps,
    completedCount,
    total: steps.length,
    allDone: completedCount === steps.length,
    nextStep: steps.find((step) => !step.done) ?? null,
  }
}

/**
 * A brand-new install: nothing logged and nothing configured. Used to decide
 * whether the tour opens by itself, which should happen once and never again
 * for someone who already has data.
 */
export function looksLikeFirstRun(signals: OnboardingSignals): boolean {
  return (
    signals.dailyLogCount === 0 &&
    signals.habitCount === 0 &&
    signals.goalCount === 0 &&
    signals.reviewCount === 0
  )
}

/**
 * Two independent triggers:
 *
 * - an explicit request from Settings always wins, whatever the data looks like;
 * - otherwise it opens by itself only on a genuine first run, once.
 */
export function shouldOpenTour(
  signals: OnboardingSignals,
  state: { tourSeenAt?: string; tourRequestedAt?: string } | null,
): boolean {
  if (state?.tourRequestedAt) return true
  if (state?.tourSeenAt) return false
  return looksLikeFirstRun(signals)
}

export function shouldShowChecklist(
  checklist: Checklist,
  state: { checklistDismissedAt?: string } | null,
): boolean {
  if (state?.checklistDismissedAt) return false
  return !checklist.allDone
}
