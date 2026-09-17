import { PATHS } from '@/lib/paths'

/**
 * The tour walks the app rather than describing it: each step opens the page it
 * is about and points at the control you would actually press there.
 *
 * `target` is a CSS selector, and the element carries `data-tour` so moving a
 * button around a page cannot silently break the step — the attribute travels
 * with it. A step whose target never appears still shows its text, centred,
 * because a missing button is no reason to strand someone mid-tour.
 *
 * Which step you are on lives in the URL (`?tour=habits`). That is what makes a
 * tour that navigates possible at all: every step survives the page load it
 * causes, and reloading in the middle puts you back where you were.
 */
export type TourStep = {
  key: string
  href: string
  target?: string
}

export const TOUR_PARAM = 'tour'

const target = (name: string) => `[data-tour="${name}"]`

/**
 * The dashboard comes first because that is the page you are already on when
 * the tour starts: step one explains where you are instead of yanking you
 * somewhere and then throwing you back.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  { key: 'home', href: PATHS.home, target: target('home-score') },
  { key: 'daily', href: PATHS.daily, target: target('daily-essentials') },
  { key: 'habits', href: PATHS.habits, target: target('habit-new') },
  { key: 'goals', href: PATHS.goals, target: target('goal-new') },
  { key: 'timer', href: PATHS.timer, target: target('timer-start') },
  { key: 'learning', href: PATHS.learningTab('notes'), target: target('note-new') },
  { key: 'finance', href: PATHS.finance, target: target('account-new') },
  { key: 'settings', href: PATHS.settings, target: target('settings-export') },
] as const

export type TourStepKey = (typeof TOUR_STEPS)[number]['key']

export function tourStepAt(index: number): TourStep | null {
  return TOUR_STEPS[index] ?? null
}

export function tourIndexOf(key: string | null | undefined): number {
  return key ? TOUR_STEPS.findIndex((step) => step.key === key) : -1
}

/** The step's own address with the tour marker added, whatever query it has. */
export function tourHref(step: TourStep): string {
  const [path, query] = step.href.split('?')
  const params = new URLSearchParams(query)
  params.set(TOUR_PARAM, step.key)
  return `${path}?${params.toString()}`
}
