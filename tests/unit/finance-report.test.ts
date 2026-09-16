import { describe, expect, it } from 'vitest'
import {
  averageOf,
  foldSlices,
  formatPeriod,
  monthlyTotals,
  monthsBack,
  parsePeriod,
  periodMonths,
  periodRange,
  previousPeriod,
  savingsRate,
  spendShares,
  type CategorySlice,
  type MonthTotals,
} from '@/lib/finance/report'

describe('parsePeriod', () => {
  it('reads a month', () => {
    expect(parsePeriod('2026-03', '2026-09-16')).toEqual({ year: 2026, month: 3 })
  })

  it('reads a bare year as the whole year', () => {
    expect(parsePeriod('2025', '2026-09-16')).toEqual({ year: 2025, month: null })
  })

  it('falls back to the month today is in when there is nothing to read', () => {
    expect(parsePeriod(undefined, '2026-09-16')).toEqual({ year: 2026, month: 9 })
  })

  it('falls back rather than trusting a hand-typed address', () => {
    for (const raw of ['2026-13', '2026-00', 'nonsense', '26-09', '2026-9', '']) {
      expect(parsePeriod(raw, '2026-09-16')).toEqual({ year: 2026, month: 9 })
    }
  })

  it('round-trips through the URL', () => {
    for (const period of [
      { year: 2026, month: 9 },
      { year: 2026, month: null },
    ]) {
      expect(parsePeriod(formatPeriod(period), '2020-01-01')).toEqual(period)
    }
  })

  it('pads a single-digit month', () => {
    expect(formatPeriod({ year: 2026, month: 3 })).toBe('2026-03')
  })
})

describe('periodRange', () => {
  it('covers one month, to its real last day', () => {
    expect(periodRange({ year: 2026, month: 2 })).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    })
  })

  it('covers a whole year', () => {
    expect(periodRange({ year: 2026, month: null })).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    })
  })
})

describe('previousPeriod', () => {
  it('steps back a month, across the turn of the year', () => {
    expect(previousPeriod({ year: 2026, month: 1 })).toEqual({ year: 2025, month: 12 })
    expect(previousPeriod({ year: 2026, month: 9 })).toEqual({ year: 2026, month: 8 })
  })

  it('steps back a year when a year is in view', () => {
    expect(previousPeriod({ year: 2026, month: null })).toEqual({ year: 2025, month: null })
  })
})

describe('periodMonths', () => {
  it('shows a month with the run-up to it', () => {
    expect(periodMonths({ year: 2026, month: 2 })).toEqual([
      '2025-09-01',
      '2025-10-01',
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
    ])
  })

  it('shows a year in full, twelve months of it', () => {
    const months = periodMonths({ year: 2026, month: null })
    expect(months).toHaveLength(12)
    expect(months[0]).toBe('2026-01-01')
    expect(months.at(-1)).toBe('2026-12-01')
  })
})

describe('monthsBack', () => {
  it('ends on the month the date falls in, oldest first', () => {
    expect(monthsBack('2026-09-16', 3)).toEqual(['2026-07-01', '2026-08-01', '2026-09-01'])
  })
})

describe('monthlyTotals', () => {
  const months = ['2026-07-01', '2026-08-01', '2026-09-01']

  it('keeps a month with nothing in it as a zero', () => {
    const totals = monthlyTotals(months, [
      { month: '2026-07-01', kind: 'expense', total: 100 },
      { month: '2026-09-01', kind: 'expense', total: 300 },
    ])

    expect(totals.map((month) => month.expense)).toEqual([100, 0, 300])
    expect(totals.map((month) => month.month)).toEqual(months)
  })

  it('leaves transfers out of both sides', () => {
    const [month] = monthlyTotals(
      ['2026-09-01'],
      [
        { month: '2026-09-01', kind: 'income', total: 50 },
        { month: '2026-09-01', kind: 'expense', total: 20 },
        { month: '2026-09-01', kind: 'transfer', total: 900 },
      ],
    )

    expect(month).toEqual({ month: '2026-09-01', income: 50, expense: 20, net: 30 })
  })
})

describe('savingsRate', () => {
  it('is the share of income left over', () => {
    expect(savingsRate(1000, 750)).toBe(25)
  })

  it('has no answer when nothing came in', () => {
    expect(savingsRate(0, 500)).toBeNull()
  })

  it('goes negative when the period ate into savings', () => {
    expect(savingsRate(1000, 1500)).toBe(-50)
  })
})

describe('spendShares', () => {
  it('sorts biggest first and shares add up to a hundred', () => {
    const shares = spendShares([
      { id: 'a', name: 'Food', total: 300, previous: 0 },
      { id: 'b', name: 'Rent', total: 700, previous: 700 },
    ])

    expect(shares.map((row) => row.name)).toEqual(['Rent', 'Food'])
    expect(shares.map((row) => row.share)).toEqual([70, 30])
  })

  it('drops a category spent on last period but not this one', () => {
    const shares = spendShares([
      { id: 'a', name: 'Food', total: 300, previous: 100 },
      { id: 'b', name: 'Taxi', total: 0, previous: 200 },
    ])

    expect(shares.map((row) => row.name)).toEqual(['Food'])
  })
})

describe('averageOf', () => {
  const month = (over: Partial<MonthTotals>): MonthTotals => ({
    month: '2026-01-01',
    income: 0,
    expense: 0,
    net: 0,
    ...over,
  })

  it('leaves out the months it is told to and the ones with nothing in them', () => {
    const average = averageOf(
      [
        month({ month: '2026-04-01' }),
        month({ month: '2026-05-01', expense: 100, income: 1 }),
        month({ month: '2026-06-01', expense: 300, income: 1 }),
        month({ month: '2026-07-01', expense: 999, income: 1 }),
      ],
      (row) => row.expense,
      ['2026-07-01'],
    )

    expect(average).toBe(200)
  })

  it('never averages the chosen month into its own yardstick', () => {
    const months = [month({ month: '2026-08-01', expense: 100, income: 1 })]
    expect(averageOf(months, (row) => row.expense, ['2026-08-01'])).toBeNull()
  })

  it('has no answer when every month in view is empty', () => {
    expect(averageOf([month({ month: '2026-05-01' })], (row) => row.expense)).toBeNull()
  })
})

describe('foldSlices', () => {
  const slice = (name: string, total: number): CategorySlice => ({
    id: name,
    name,
    total,
    previous: 1,
    share: total,
  })

  it('leaves a readable pie alone', () => {
    const rows = [slice('a', 5), slice('b', 4), slice('c', 3)]
    expect(foldSlices(rows, 'Other', 7)).toBe(rows)
  })

  it('folds the tail into one slice that carries its totals', () => {
    const rows = [10, 9, 8, 7].map((value, index) => slice(`c${index}`, value))
    const folded = foldSlices(rows, 'Other', 2)

    expect(folded.map((row) => row.name)).toEqual(['c0', 'c1', 'Other'])
    const rest = folded.at(-1)
    expect(rest?.total).toBe(15)
    expect(rest?.share).toBe(15)
    expect(rest?.previous).toBe(2)
    expect(rest?.id).toBeNull()
    // Several categories added up is not the same as spending with no
    // category, and both would otherwise be an id of null.
    expect(rest?.rest).toBe(true)
    expect(folded[0]?.rest).toBeUndefined()
  })

  it('does not fold a single spare category into an "other" of one', () => {
    const rows = [5, 4, 3].map((value, index) => slice(`c${index}`, value))
    expect(foldSlices(rows, 'Other', 2)).toBe(rows)
  })
})
