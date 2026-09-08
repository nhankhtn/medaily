import { describe, expect, it } from 'vitest'
import type { DaySeriesEntry } from '@/lib/analytics/day-series'
import { DEFAULT_INSIGHT_THRESHOLDS } from '@/lib/defaults'
import { generateInsights, selectForDashboard } from '@/lib/insights/rules'
import { addDays } from '@/lib/dates'

const TODAY = '2026-09-07'

/** Builds a 28-day series ending today, oldest → newest. */
function makeSeries(
  overrides: (index: number) => Partial<{
    logged: boolean
    sleepHours: number | null
    energy: number | null
    exerciseMinutes: number
    entertainmentMinutes: number
    studyMinutes: number
  }> = () => ({}),
): DaySeriesEntry[] {
  return Array.from({ length: 28 }, (_, i) => {
    const date = addDays(TODAY, -(27 - i))
    const o = overrides(i)
    const logged = o.logged ?? true
    const study = o.studyMinutes ?? 60

    return {
      date,
      logged,
      log: logged
        ? {
            id: `id-${i}`,
            logDate: date,
            energy: o.energy ?? 7,
            mood: 7,
            sleepHours: o.sleepHours ?? 7.5,
            technicalStudyMinutes: study,
            deepWorkMinutes: 60,
            effectiveStudyMinutes: study,
            effectiveDeepWorkMinutes: 60,
            exerciseMinutes: o.exerciseMinutes ?? 30,
            exerciseType: 'Running',
            readingMinutes: 20,
            readingPages: null,
            entertainmentMinutes: o.entertainmentMinutes ?? 40,
            englishMinutes: null,
            dailyWin: null,
            dailyProblem: null,
            tomorrowPriority: null,
            note: null,
            sessionCount: 0,
          }
        : null,
      score: null,
      habitsScheduled: 0,
      habitsCompleted: 0,
      exerciseDaysLast7: 4,
      studyMinutes: logged ? study : null,
      deepWorkMinutes: logged ? 60 : null,
      focusMinutes: logged ? study + 60 : null,
    }
  })
}

const run = (series: DaySeriesEntry[]) =>
  generateInsights({ series, today: TODAY, thresholds: DEFAULT_INSIGHT_THRESHOLDS })

describe('warning rules', () => {
  it('stays quiet on a healthy series', () => {
    const kinds = run(makeSeries()).map((insight) => insight.kind)
    expect(kinds).not.toContain('sleep_deficit_streak')
    expect(kinds).not.toContain('exercise_gap')
    expect(kinds).not.toContain('entertainment_creep')
    expect(kinds).not.toContain('logging_gap')
  })

  it('raises a sleep deficit only after three consecutive short nights', () => {
    const two = run(makeSeries((i) => (i >= 26 ? { sleepHours: 5.5 } : {})))
    expect(two.map((i) => i.kind)).not.toContain('sleep_deficit_streak')

    const three = run(makeSeries((i) => (i >= 25 ? { sleepHours: 5.5 } : {})))
    const found = three.find((insight) => insight.kind === 'sleep_deficit_streak')
    expect(found?.severity).toBe('high')
    expect(found?.payload.values.days).toBe(3)
  })

  it('raises entertainment creep on four heavy days in a week', () => {
    const insights = run(
      makeSeries((i) => (i >= 24 ? { entertainmentMinutes: 200 } : {})),
    )
    const found = insights.find((insight) => insight.kind === 'entertainment_creep')
    expect(found?.payload.values.days).toBe(4)
  })

  it('raises an exercise gap after five days without a session', () => {
    const insights = run(makeSeries((i) => (i >= 23 ? { exerciseMinutes: 0 } : {})))
    expect(insights.map((i) => i.kind)).toContain('exercise_gap')
  })

  it('raises a study slump when the week collapses against the previous one', () => {
    const insights = run(makeSeries((i) => (i >= 21 ? { studyMinutes: 10 } : {})))
    const found = insights.find((insight) => insight.kind === 'study_slump')
    expect(found).toBeDefined()
    expect(Number(found?.payload.values.current)).toBeLessThan(
      Number(found?.payload.values.previous),
    )
  })

  it('raises an energy decline of at least 1.5 points', () => {
    const insights = run(
      makeSeries((i) => (i >= 21 ? { energy: 5 } : { energy: 8 })),
    )
    expect(insights.map((i) => i.kind)).toContain('energy_decline')
  })

  it('counts a logging gap without blaming an unlogged today', () => {
    const todayOnly = run(makeSeries((i) => (i === 27 ? { logged: false } : {})))
    expect(todayOnly.map((i) => i.kind)).not.toContain('logging_gap')

    const twoDays = run(makeSeries((i) => (i >= 25 && i <= 26 ? { logged: false } : {})))
    const found = twoDays.find((insight) => insight.kind === 'logging_gap')
    expect(found?.payload.values.days).toBe(2)
  })
})

describe('goal, habit and streak signals', () => {
  it('flags a goal that is off pace near its deadline', () => {
    const insights = generateInsights({
      series: makeSeries(),
      today: TODAY,
      thresholds: DEFAULT_INSIGHT_THRESHOLDS,
      goals: [{ id: 'g1', name: 'Ship v1', percent: 30, daysRemaining: 7, status: 'active' }],
    })
    const found = insights.find((insight) => insight.kind === 'goal_off_pace')
    expect(found?.payload.values.goal).toBe('Ship v1')
  })

  it('ignores a goal that is comfortably ahead', () => {
    const insights = generateInsights({
      series: makeSeries(),
      today: TODAY,
      thresholds: DEFAULT_INSIGHT_THRESHOLDS,
      goals: [{ id: 'g1', name: 'Ship v1', percent: 95, daysRemaining: 7, status: 'active' }],
    })
    expect(insights.map((i) => i.kind)).not.toContain('goal_off_pace')
  })

  it('nudges a long streak only while today is still open', () => {
    const open = generateInsights({
      series: makeSeries(),
      today: TODAY,
      thresholds: DEFAULT_INSIGHT_THRESHOLDS,
      streaks: [{ kind: 'logging', current: 12, pendingToday: true, isBest: false }],
    })
    expect(open.map((i) => i.kind)).toContain('streak_in_danger')

    const closed = generateInsights({
      series: makeSeries(),
      today: TODAY,
      thresholds: DEFAULT_INSIGHT_THRESHOLDS,
      streaks: [{ kind: 'logging', current: 12, pendingToday: false, isBest: false }],
    })
    expect(closed.map((i) => i.kind)).not.toContain('streak_in_danger')
  })

  it('celebrates a new best streak', () => {
    const insights = generateInsights({
      series: makeSeries(),
      today: TODAY,
      thresholds: DEFAULT_INSIGHT_THRESHOLDS,
      streaks: [{ kind: 'study', current: 21, pendingToday: false, isBest: true }],
    })
    const win = insights.find((insight) => insight.kind === 'win_best_streak')
    expect(win?.severity).toBe('win')
  })
})

describe('selectForDashboard', () => {
  it('shows at most three warnings, worst first, plus one win', () => {
    const insights = generateInsights({
      series: makeSeries((i) => ({
        sleepHours: 5,
        entertainmentMinutes: 200,
        exerciseMinutes: 0,
        energy: i >= 21 ? 4 : 8,
      })),
      today: TODAY,
      thresholds: DEFAULT_INSIGHT_THRESHOLDS,
      streaks: [{ kind: 'study', current: 21, pendingToday: false, isBest: true }],
    })

    const selected = selectForDashboard(insights)
    const warnings = selected.filter((insight) => insight.severity !== 'win')
    const wins = selected.filter((insight) => insight.severity === 'win')

    expect(warnings.length).toBeLessThanOrEqual(3)
    expect(wins.length).toBeLessThanOrEqual(1)
    expect(warnings[0]?.severity).toBe('high')
  })

  it('produces a stable dedupe key per occurrence', () => {
    const first = run(makeSeries((i) => (i >= 25 ? { sleepHours: 5 } : {})))
    const second = run(makeSeries((i) => (i >= 25 ? { sleepHours: 5 } : {})))
    expect(first.map((i) => i.dedupeKey)).toEqual(second.map((i) => i.dedupeKey))
  })
})
