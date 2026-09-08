import { describe, expect, it } from 'vitest'
import {
  buildChecklist,
  CHECKLIST_STEPS,
  looksLikeFirstRun,
  shouldOpenTour,
  shouldShowChecklist,
  TOUR_STEPS,
  type OnboardingSignals,
} from '@/lib/onboarding'

const empty: OnboardingSignals = {
  dailyLogCount: 0,
  habitCount: 0,
  goalCount: 0,
  reviewCount: 0,
}

describe('buildChecklist', () => {
  it('marks everything undone on a fresh install and points at the first step', () => {
    const checklist = buildChecklist(empty)
    expect(checklist.completedCount).toBe(0)
    expect(checklist.total).toBe(CHECKLIST_STEPS.length)
    expect(checklist.allDone).toBe(false)
    expect(checklist.nextStep?.key).toBe('log')
  })

  it('advances as real rows appear', () => {
    const checklist = buildChecklist({ ...empty, dailyLogCount: 1, habitCount: 2 })
    expect(checklist.steps.find((step) => step.key === 'log')?.done).toBe(true)
    expect(checklist.steps.find((step) => step.key === 'habit')?.done).toBe(true)
    expect(checklist.nextStep?.key).toBe('goal')
  })

  it('reports partial progress towards a multi-day step', () => {
    const step = buildChecklist({ ...empty, dailyLogCount: 2 }).steps.find(
      (candidate) => candidate.key === 'trends',
    )
    expect(step).toMatchObject({ done: false, current: 2, target: 3 })
  })

  it('never reports more progress than the target', () => {
    const step = buildChecklist({ ...empty, dailyLogCount: 90 }).steps.find(
      (candidate) => candidate.key === 'trends',
    )
    expect(step).toMatchObject({ done: true, current: 3, target: 3 })
  })

  it('completes and stops nagging once every step is met', () => {
    const checklist = buildChecklist({
      dailyLogCount: 5,
      habitCount: 1,
      goalCount: 1,
      reviewCount: 1,
    })
    expect(checklist.allDone).toBe(true)
    expect(checklist.nextStep).toBeNull()
    expect(shouldShowChecklist(checklist, null)).toBe(false)
  })
})

describe('visibility rules', () => {
  it('opens the tour by itself only on a first run that has not seen it', () => {
    expect(shouldOpenTour(empty, null)).toBe(true)
    expect(shouldOpenTour(empty, { tourSeenAt: '2026-09-08T00:00:00Z' })).toBe(false)
    // Someone with data is not a new user, even if they never saw the tour.
    expect(shouldOpenTour({ ...empty, dailyLogCount: 1 }, null)).toBe(false)
  })

  it('honours an explicit replay request whatever the data looks like', () => {
    const withData = { dailyLogCount: 85, habitCount: 6, goalCount: 4, reviewCount: 1 }
    // Without this, "show the introduction again" could never work for anyone
    // who had already started using the app.
    expect(
      shouldOpenTour(withData, {
        tourSeenAt: '2026-01-01T00:00:00Z',
        tourRequestedAt: '2026-09-08T00:00:00Z',
      }),
    ).toBe(true)
    expect(shouldOpenTour(withData, { tourSeenAt: '2026-01-01T00:00:00Z' })).toBe(false)
  })

  it('detects a first run only when nothing at all exists', () => {
    expect(looksLikeFirstRun(empty)).toBe(true)
    expect(looksLikeFirstRun({ ...empty, goalCount: 1 })).toBe(false)
    expect(looksLikeFirstRun({ ...empty, reviewCount: 1 })).toBe(false)
  })

  it('hides a dismissed checklist even when steps remain', () => {
    const checklist = buildChecklist(empty)
    expect(shouldShowChecklist(checklist, null)).toBe(true)
    expect(shouldShowChecklist(checklist, { checklistDismissedAt: '2026-09-08' })).toBe(false)
  })
})

describe('step registries', () => {
  it('has unique keys and real hrefs', () => {
    for (const steps of [TOUR_STEPS, CHECKLIST_STEPS] as const) {
      const keys = steps.map((step) => step.key)
      expect(new Set(keys).size).toBe(keys.length)
      expect(steps.every((step) => step.href.startsWith('/'))).toBe(true)
    }
  })

  it('keeps the tour short enough to actually be read', () => {
    expect(TOUR_STEPS.length).toBeLessThanOrEqual(6)
  })
})
