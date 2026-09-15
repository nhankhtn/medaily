import { describe, expect, it } from 'vitest'
import { MAX_MILESTONES, toGoalDraft, type ParsedGoal } from '../../src/lib/goals/draft'

const today = '2026-09-15'

/** What a well-behaved answer looks like; each test bends one field. */
const complete: ParsedGoal = {
  name: 'Học tiếng Anh mỗi ngày',
  description: '',
  category: 'knowledge',
  priority: 'medium',
  start_date: today,
  target_date: '2026-12-31',
  progress_mode: 'metric',
  metric_key: 'english_minutes',
  metric_aggregation: 'sum',
  metric_period: 'weekly',
  metric_target: 210,
  metric_direction: 'at_least',
  milestones: [],
}

const draft = (overrides: ParsedGoal = {}) =>
  toGoalDraft({ parsed: { ...complete, ...overrides }, today })

describe('toGoalDraft', () => {
  it('keeps a complete metric goal as it came', () => {
    expect(draft()).toEqual({
      name: 'Học tiếng Anh mỗi ngày',
      description: null,
      category: 'knowledge',
      priority: 'medium',
      startDate: today,
      targetDate: '2026-12-31',
      progressMode: 'metric',
      metric: {
        key: 'english_minutes',
        aggregation: 'sum',
        period: 'weekly',
        target: 210,
        direction: 'at_least',
      },
      milestoneTitles: [],
    })
  })

  it('refuses a goal with no name, because nothing can stand in for one', () => {
    expect(draft({ name: '   ' })).toBeNull()
    expect(draft({ name: 42 })).toBeNull()
  })

  it('falls back to the safe end of every closed list', () => {
    const result = draft({ category: 'travel', priority: 'urgent', progress_mode: 'auto' })
    expect(result).toMatchObject({ category: 'life', priority: 'medium', progressMode: 'manual' })
  })

  it('never invents a metric the app does not track', () => {
    const result = draft({ metric_key: 'books_read' })
    expect(result?.metric).toBeNull()
    // And the mode follows, so the form does not open on an empty metric block.
    expect(result?.progressMode).toBe('manual')
  })

  it('drops a metric with no usable target', () => {
    expect(draft({ metric_target: 0 })?.metric).toBeNull()
    expect(draft({ metric_target: 'a lot' })?.metric).toBeNull()
  })

  it('fills the metric details a model left off', () => {
    const result = draft({
      metric_aggregation: '',
      metric_period: '',
      metric_direction: '',
    })
    expect(result?.metric).toMatchObject({
      aggregation: 'sum',
      period: 'total',
      direction: 'at_least',
    })
  })

  it('starts today when no start is given, and clamps a wild one', () => {
    expect(draft({ start_date: '' })?.startDate).toBe(today)
    expect(draft({ start_date: 'next monday' })?.startDate).toBe(today)
    expect(draft({ start_date: '2030-01-01' })?.startDate).toBe('2027-09-15')
    expect(draft({ start_date: '2019-01-01' })?.startDate).toBe('2025-09-15')
  })

  it('keeps a start the text genuinely moved', () => {
    expect(draft({ start_date: '2026-10-01' })?.startDate).toBe('2026-10-01')
  })

  it('drops a deadline that lands before the start rather than saving a rejected row', () => {
    expect(draft({ target_date: '2026-09-01' })?.targetDate).toBeNull()
    expect(draft({ target_date: '' })?.targetDate).toBeNull()
  })

  it('caps a deadline a decade out', () => {
    expect(draft({ target_date: '2099-01-01' })?.targetDate).toBe('2036-09-12')
  })

  it('reads milestones, trimming and capping them', () => {
    const result = draft({
      progress_mode: 'milestones',
      metric_key: '',
      milestones: ['  Chương 1  ', '', 'Chương 2', 7],
    })
    expect(result?.milestoneTitles).toEqual(['Chương 1', 'Chương 2'])
    expect(result?.progressMode).toBe('milestones')
  })

  it('does not open in milestone mode with no milestones', () => {
    const result = draft({ progress_mode: 'milestones', metric_key: '', milestones: [] })
    expect(result?.progressMode).toBe('manual')
  })

  it('takes at most twenty milestones', () => {
    const many = Array.from({ length: 30 }, (_, index) => `Bước ${index + 1}`)
    expect(draft({ milestones: many })?.milestoneTitles).toHaveLength(MAX_MILESTONES)
  })

  it('survives an answer that is almost entirely missing', () => {
    expect(toGoalDraft({ parsed: { name: 'Chạy bộ' }, today })).toEqual({
      name: 'Chạy bộ',
      description: null,
      category: 'life',
      priority: 'medium',
      startDate: today,
      targetDate: null,
      progressMode: 'manual',
      metric: null,
      milestoneTitles: [],
    })
  })
})
