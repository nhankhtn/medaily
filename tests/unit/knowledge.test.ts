import { describe, expect, it } from 'vitest'
import { extractWikiLinks, parseTags } from '@/lib/knowledge/links'
import { formatCompactMoney, formatMoney } from '@/lib/format/money'

describe('extractWikiLinks', () => {
  it('finds links and keeps first-seen order', () => {
    expect(extractWikiLinks('See [[MVCC]] then [[Vacuum]].')).toEqual(['MVCC', 'Vacuum'])
  })

  it('de-duplicates repeated links', () => {
    expect(extractWikiLinks('[[A]] and [[A]] again')).toEqual(['A'])
  })

  it('trims whitespace inside the brackets', () => {
    expect(extractWikiLinks('[[  Spaced title  ]]')).toEqual(['Spaced title'])
  })

  it('ignores empty and unclosed brackets', () => {
    expect(extractWikiLinks('[[]] [[ ]] [[unclosed')).toEqual([])
  })

  it('returns nothing for plain text', () => {
    expect(extractWikiLinks('no links here [single] brackets')).toEqual([])
  })
})

describe('parseTags', () => {
  it('splits, trims and drops empties', () => {
    expect(parseTags('db, postgres ,, indexing')).toEqual(['db', 'postgres', 'indexing'])
  })

  it('strips a leading hash and de-duplicates', () => {
    expect(parseTags('#db, db')).toEqual(['db'])
  })

  it('caps the list', () => {
    const many = Array.from({ length: 30 }, (_, i) => `t${i}`).join(',')
    expect(parseTags(many)).toHaveLength(20)
  })
})

describe('formatMoney', () => {
  it('drops minor units for VND', () => {
    const formatted = formatMoney(1234567, 'VND', 'vi')
    expect(formatted).toMatch(/1/)
    expect(formatted).not.toMatch(/,00|\.00/)
  })

  it('keeps two decimals for USD', () => {
    expect(formatMoney(12.5, 'USD', 'en')).toBe('$12.50')
  })

  it('falls back instead of throwing on an unknown currency', () => {
    expect(formatMoney(10, 'XYZZY', 'en')).toContain('XYZZY')
    expect(formatCompactMoney(10, 'XYZZY', 'en')).toContain('XYZZY')
  })
})
