import { describe, expect, it } from 'vitest'
import { groupByDay, slot, splitSlots } from '@/features/finance/ledger-days'

type Row = {
  id: string
  occurredOn: string
  kind: 'income' | 'expense' | 'transfer'
  amount: string
  currency?: string
}

const row = (id: string, occurredOn: string, kind: Row['kind'], amount: number, currency = 'VND') =>
  ({ id, occurredOn, kind, amount: String(amount), currency }) satisfies Row

describe('groupByDay', () => {
  it('puts a header before each day and sums income and spending apart', () => {
    const entries = groupByDay(
      [
        row('a', '2026-10-02', 'expense', 30000),
        row('b', '2026-10-02', 'income', 500000),
        row('c', '2026-10-02', 'expense', 25000),
        row('d', '2026-10-01', 'expense', 100000),
      ],
      { currency: 'VND', complete: true },
    )

    expect(entries.map((entry) => (entry.type === 'day' ? `#${entry.day}` : entry.row.id))).toEqual(
      ['#2026-10-02', 'a', 'b', 'c', '#2026-10-01', 'd'],
    )
    expect(entries[0]).toMatchObject({ totals: { income: 500000, expense: 55000 } })
    expect(entries[4]).toMatchObject({ totals: { income: 0, expense: 100000 } })
  })

  it('leaves transfers and other currencies out of the totals', () => {
    const [header] = groupByDay(
      [
        row('a', '2026-10-02', 'transfer', 1000000),
        row('b', '2026-10-02', 'expense', 12, 'USD'),
        row('c', '2026-10-02', 'expense', 40000),
      ],
      { currency: 'VND', complete: true },
    )
    expect(header).toMatchObject({ totals: { income: 0, expense: 40000 } })
  })

  it('drops the totals of the last day while more pages may still hold part of it', () => {
    const entries = groupByDay(
      [row('a', '2026-10-02', 'expense', 1), row('b', '2026-10-01', 'expense', 2)],
      { currency: 'VND', complete: false },
    )
    expect(entries[0]).toMatchObject({ totals: { expense: 1 } })
    expect(entries[2]).toMatchObject({ type: 'day', totals: null })
  })

  it('returns nothing for no rows', () => {
    expect(groupByDay([], { currency: 'VND', complete: false })).toEqual([])
  })
})

describe('splitSlots', () => {
  it('finds the slots a formatted sentence carries, in order', () => {
    expect(splitSlots(`${slot(0)} of ${slot(1)}`)).toEqual([0, ' of ', 1])
    expect(splitSlots(`Còn ${slot(0)}`)).toEqual(['Còn ', 0])
  })

  it('leaves a sentence without slots whole', () => {
    expect(splitSlots('nothing here')).toEqual(['nothing here'])
  })
})
