import { describe, expect, it } from 'vitest'
import { diff } from '@/lib/activity/diff'
import { identify } from '@/lib/activity/identity'

/**
 * The trail stores two snapshots and works the difference out when it is read.
 * These are about that reading being right — most of all about it not claiming
 * a save did something it never did.
 */
describe('reading a change out of two snapshots', () => {
  it('reports a create as every field arriving', () => {
    expect(diff(null, { amount: '125.000 VND', merchant: 'Highlands' })).toEqual([
      { field: 'amount', from: null, to: '125.000 VND' },
      { field: 'merchant', from: null, to: 'Highlands' },
    ])
  })

  it('reports a delete as every field going', () => {
    expect(diff({ amount: '125.000 VND' }, null)).toEqual([
      { field: 'amount', from: '125.000 VND', to: null },
    ])
  })

  it('reports only what moved on an edit', () => {
    const before = { amount: '125.000 VND', merchant: 'Highlands', category: 'Ăn uống' }
    const after = { amount: '250.000 VND', merchant: 'Highlands', category: 'Đi lại' }

    expect(diff(before, after)).toEqual([
      { field: 'amount', from: '125.000 VND', to: '250.000 VND' },
      { field: 'category', from: 'Ăn uống', to: 'Đi lại' },
    ])
  })

  it('says nothing about a save that touched nothing', () => {
    const row = { amount: '125.000 VND', merchant: 'Highlands' }
    expect(diff(row, { ...row })).toEqual([])
  })

  /**
   * The one that would libel a save. A request carrying no `merchant` did not
   * ask for the merchant to be cleared, and a diff over the union of both
   * sides would report `"Highlands" → nothing` on every edit that left the
   * field alone.
   */
  it('ignores a field the request never mentioned', () => {
    const before = { amount: '125.000 VND', merchant: 'Highlands' }
    expect(diff(before, { amount: '250.000 VND' })).toEqual([
      { field: 'amount', from: '125.000 VND', to: '250.000 VND' },
    ])
  })

  it('does report a field the request cleared on purpose', () => {
    expect(diff({ merchant: 'Highlands' }, { merchant: null })).toEqual([
      { field: 'merchant', from: 'Highlands', to: null },
    ])
  })

  it.each([
    ['empty to absent', { note: '' }, { note: null }],
    ['absent to empty', { note: null }, { note: '' }],
    ['whitespace to empty', { note: '   ' }, { note: '' }],
  ])('treats %s as no change', (_case, before, after) => {
    expect(diff(before, after)).toEqual([])
  })

  it('answers nothing when neither side exists', () => {
    expect(diff(null, null)).toEqual([])
  })

  /** A bulk import would otherwise write a row nobody could read. */
  it('stops at twelve fields', () => {
    const wide = Object.fromEntries(
      Array.from({ length: 30 }, (_, index) => [`f${index}`, String(index)]),
    )
    expect(diff(null, wide)).toHaveLength(12)
  })

  it('cuts a value that is prose rather than a name', () => {
    const long = Array.from({ length: 200 }, () => 'dài').join(' ')
    const [change] = diff(null, { note: long })
    expect(change?.to).toHaveLength(80)
  })

  /** A person can paste a token into a merchant field, and often has. */
  it('redacts a credential that reached a value', () => {
    const [change] = diff(null, { note: 'token=super-secret-value' })
    expect(change?.to).toBe('token=***')
  })
})

describe('saying which row a line was about', () => {
  it('names a transaction by where and when, so two coffees are told apart', () => {
    expect(identify({ merchant: 'Highlands', occurredOn: '15/09/2026' })).toBe(
      'Highlands · 15/09/2026',
    )
  })

  /** The case that prompted it: an amount edited, nothing else, no merchant. */
  it('falls back to the category when nothing was typed in for a merchant', () => {
    expect(identify({ category: 'Ăn uống', occurredOn: '15/09/2026' })).toBe('Ăn uống · 15/09/2026')
  })

  it('uses the date alone rather than nothing', () => {
    expect(identify({ occurredOn: '15/09/2026', amount: '100.000 VND' })).toBe('15/09/2026')
  })

  it.each([
    ['a person', { name: 'Trang' }, 'Trang'],
    ['a note', { title: 'Đọc sách' }, 'Đọc sách'],
  ])('names %s by the one field that already identifies it', (_case, snapshot, expected) => {
    expect(identify(snapshot)).toBe(expected)
  })

  it.each([[null], [undefined], [{}], [{ amount: '100.000 VND' }]])(
    'answers nothing for %j, leaving the stored label to speak',
    (snapshot) => {
      expect(identify(snapshot)).toBeNull()
    },
  )
})
