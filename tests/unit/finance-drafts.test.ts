import { describe, expect, it } from 'vitest'
import { matchCategoryId, toDrafts, MAX_DRAFTS } from '../../src/lib/finance/drafts'
import { foldText } from '../../src/lib/text'

const categories = [
  { id: 'cat-food', name: 'Ăn uống', kind: 'expense' },
  { id: 'cat-fuel', name: 'Xăng xe', kind: 'expense' },
  { id: 'cat-salary', name: 'Lương', kind: 'income' },
]

const today = '2026-09-13'

describe('foldText', () => {
  it('strips Vietnamese accents and the barred d', () => {
    expect(foldText('Ăn uống')).toBe('an uong')
    expect(foldText('Đầu tư')).toBe('dau tu')
  })
})

describe('matchCategoryId', () => {
  it('matches an accent-free spelling of the name', () => {
    expect(matchCategoryId('an uong', categories, 'expense')).toBe('cat-food')
  })

  it('only considers categories of the same kind', () => {
    expect(matchCategoryId('Lương', categories, 'expense')).toBeNull()
    expect(matchCategoryId('Lương', categories, 'income')).toBe('cat-salary')
  })

  it('never invents a category the user does not have', () => {
    expect(matchCategoryId('Du lịch', categories, 'expense')).toBeNull()
    expect(matchCategoryId('', categories, 'expense')).toBeNull()
    expect(matchCategoryId(null, categories, 'expense')).toBeNull()
  })

  it('prefers the longest partial match', () => {
    const pool = [
      { id: 'short', name: 'Ăn', kind: 'expense' },
      { id: 'long', name: 'Ăn uống ngoài', kind: 'expense' },
    ]
    expect(matchCategoryId('ăn uống ngoài hàng', pool, 'expense')).toBe('long')
  })
})

describe('toDrafts', () => {
  const drafts = (parsed: Record<string, unknown>[]) => toDrafts({ parsed, categories, today })

  it('folds the note into the merchant, which is the only line the ledger shows', () => {
    expect(
      drafts([
        {
          occurred_on: '2026-09-12',
          amount: 40000,
          kind: 'expense',
          merchant: 'bánh mì',
          note: 'sáng ăn',
        },
      ])[0]?.merchant,
    ).toBe('bánh mì — sáng ăn')
  })

  it('keeps a note that arrives without a merchant', () => {
    expect(
      drafts([{ occurred_on: '2026-09-12', amount: 40000, kind: 'expense', note: 'sáng ăn' }])[0]
        ?.merchant,
    ).toBe('sáng ăn')
  })

  it('maps a well-formed row through', () => {
    expect(
      drafts([
        {
          occurred_on: '2026-09-12',
          amount: 40000,
          kind: 'expense',
          category: 'Ăn uống',
          merchant: 'Phở Thìn',
          note: '',
        },
      ]),
    ).toEqual([
      {
        id: 'draft-0',
        occurredOn: '2026-09-12',
        amount: 40000,
        kind: 'expense',
        categoryId: 'cat-food',
        merchant: 'Phở Thìn',
      },
    ])
  })

  it('drops rows with no usable amount rather than guessing one', () => {
    expect(drafts([{ amount: 0 }, { amount: -5 }, { amount: 'nope' }, {}])).toEqual([])
  })

  it('rounds to whole cents', () => {
    expect(drafts([{ amount: 40000.000000001 }])[0]?.amount).toBe(40000)
    expect(drafts([{ amount: 12.345 }])[0]?.amount).toBe(12.35)
  })

  it('clamps a future date back to today and keeps the row', () => {
    expect(drafts([{ amount: 100, occurred_on: '2027-01-01' }])[0]?.occurredOn).toBe(today)
  })

  it('clamps a date older than a year up to the window', () => {
    expect(drafts([{ amount: 100, occurred_on: '2000-01-01' }])[0]?.occurredOn).toBe('2025-09-13')
  })

  it('falls back to today when the date is missing or malformed', () => {
    expect(drafts([{ amount: 100 }])[0]?.occurredOn).toBe(today)
    expect(drafts([{ amount: 100, occurred_on: 'hôm qua' }])[0]?.occurredOn).toBe(today)
  })

  it('treats anything that is not income as an expense', () => {
    expect(drafts([{ amount: 1, kind: 'transfer' }])[0]?.kind).toBe('expense')
    expect(drafts([{ amount: 1, kind: 'income' }])[0]?.kind).toBe('income')
  })

  it('caps the batch', () => {
    const many = Array.from({ length: MAX_DRAFTS + 10 }, () => ({ amount: 1 }))
    expect(drafts(many)).toHaveLength(MAX_DRAFTS)
  })

  it('gives every row a distinct id', () => {
    const ids = drafts([{ amount: 1 }, { amount: 2 }, { amount: 3 }]).map((row) => row.id)
    expect(new Set(ids).size).toBe(3)
  })
})
