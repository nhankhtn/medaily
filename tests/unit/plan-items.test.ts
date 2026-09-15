import { describe, expect, it } from 'vitest'
import {
  MAX_PLAN_ITEMS,
  toPlanItems,
  type ParsedPlanItem,
  type PlanItem,
} from '../../src/lib/capture/plan-items'

const today = '2026-09-15'

const parse = (parsed: ParsedPlanItem[]): PlanItem[] => toPlanItems({ parsed, today })

const task = (overrides: ParsedPlanItem = {}): ParsedPlanItem => ({
  kind: 'task',
  title: 'Nộp báo cáo quý 3',
  due_date: '2026-09-18',
  priority: 'medium',
  estimate_minutes: 0,
  ...overrides,
})

const goal = (overrides: ParsedPlanItem = {}): ParsedPlanItem => ({
  kind: 'goal',
  name: 'Học tiếng Anh mỗi ngày',
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
  ...overrides,
})

describe('toPlanItems', () => {
  it('keeps goals and tasks apart, in the order they were written', () => {
    const items = parse([task(), goal(), task({ title: 'Gọi thợ sửa máy lạnh' })])
    expect(items.map((item) => item.kind)).toEqual(['task', 'goal', 'task'])
  })

  it('reads a task', () => {
    expect(parse([task({ estimate_minutes: 120, priority: 'high' })])[0]).toEqual({
      id: 'item-0',
      kind: 'task',
      task: {
        title: 'Nộp báo cáo quý 3',
        dueDate: '2026-09-18',
        priority: 'high',
        estimateMinutes: 120,
      },
    })
  })

  it('hands a goal to the goal rules', () => {
    const item = parse([goal()])[0]
    expect(item).toMatchObject({
      kind: 'goal',
      goal: { name: 'Học tiếng Anh mỗi ngày', progressMode: 'metric' },
    })
  })

  it('treats anything not clearly a goal as a task', () => {
    expect(parse([task({ kind: 'note' })])[0]?.kind).toBe('task')
    expect(parse([task({ kind: undefined })])[0]?.kind).toBe('task')
  })

  it('takes a task title from the goal field when the model filled the wrong one', () => {
    const item = parse([task({ title: '', name: 'Đặt lịch khám răng' })])[0]
    expect(item).toMatchObject({ kind: 'task', task: { title: 'Đặt lịch khám răng' } })
  })

  it('drops a row with nothing to call it', () => {
    expect(parse([task({ title: '', name: '' })])).toEqual([])
    expect(parse([goal({ name: '   ' })])).toEqual([])
  })

  it('numbers the rows it kept, not the rows it was given', () => {
    const items = parse([task({ title: '' }), task(), task({ title: 'Gọi mẹ' })])
    expect(items.map((item) => item.id)).toEqual(['item-0', 'item-1'])
  })

  it('accepts an overdue date but not one from another era', () => {
    expect(parse([task({ due_date: '2026-09-01' })])[0]).toMatchObject({
      task: { dueDate: '2026-09-01' },
    })
    expect(parse([task({ due_date: '2001-01-01' })])[0]).toMatchObject({
      task: { dueDate: '2025-09-15' },
    })
    expect(parse([task({ due_date: '2099-01-01' })])[0]).toMatchObject({
      task: { dueDate: '2036-09-12' },
    })
  })

  it('leaves a task undated when the date is not one', () => {
    expect(parse([task({ due_date: 'thứ 6' })])[0]).toMatchObject({ task: { dueDate: null } })
    expect(parse([task({ due_date: '' })])[0]).toMatchObject({ task: { dueDate: null } })
  })

  it('reads an estimate, and treats a missing one as missing', () => {
    expect(parse([task({ estimate_minutes: 0 })])[0]).toMatchObject({
      task: { estimateMinutes: null },
    })
    expect(parse([task({ estimate_minutes: 90.4 })])[0]).toMatchObject({
      task: { estimateMinutes: 90 },
    })
    // The `estimate_range` CHECK stops at a week of minutes.
    expect(parse([task({ estimate_minutes: 99_999 })])[0]).toMatchObject({
      task: { estimateMinutes: 10_080 },
    })
  })

  it('falls back to a middling priority', () => {
    expect(parse([task({ priority: 'urgent' })])[0]).toMatchObject({
      task: { priority: 'medium' },
    })
  })

  it('takes at most fifteen rows', () => {
    const many = Array.from({ length: 30 }, (_, index) => task({ title: `Việc ${index}` }))
    expect(parse(many)).toHaveLength(MAX_PLAN_ITEMS)
  })

  it('returns nothing for a note that named nothing to do', () => {
    expect(parse([])).toEqual([])
  })
})
