import { describe, expect, it } from 'vitest'
import {
  extractWikiLinks,
  noteLinkTargets,
  parseTags,
  withResolvedWikiLinks,
} from '@/lib/knowledge/links'
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

describe('resolving wiki links for display', () => {
  const notes = [
    { id: 'id-mvcc', title: 'MVCC' },
    { id: 'id-vacuum', title: 'Postgres vacuum' },
  ]
  const targets = noteLinkTargets(notes)
  const href = (id: string) => `/knowledge?note=${id}`
  const render = (body: string) => withResolvedWikiLinks(body, targets, href)

  it('turns a link to an existing note into a real link', () => {
    expect(render('See [[MVCC]].')).toBe('See [MVCC](/knowledge?note=id-mvcc).')
  })

  it('matches the title whatever the casing or spacing', () => {
    expect(render('[[  mvcc  ]]')).toBe('[mvcc](/knowledge?note=id-mvcc)')
  })

  /**
   * An unwritten note has nowhere to send the reader, so the brackets stay —
   * and they are the signal that this one is still an intention. It starts
   * linking on its own once that note exists.
   */
  it('leaves a link to a note that does not exist yet as bold brackets', () => {
    expect(render('[[Not written]]')).toBe('**[[Not written]]**')
  })

  it('leaves ordinary markdown alone', () => {
    const body = 'A [real link](https://example.com) and `[[code]]`-ish text'
    expect(render(body)).toContain('[real link](https://example.com)')
  })

  it('only rewrites what extractWikiLinks would have stored', () => {
    // A bracket inside the title is not a link there, so it must not be one here.
    const body = '[[has [bracket] inside]]'
    expect(extractWikiLinks(body)).toEqual([])
    expect(render(body)).toBe(body)
  })
})

describe('noteLinkTargets', () => {
  it('keys by lowercased, trimmed title', () => {
    expect(noteLinkTargets([{ id: 'a', title: '  Spaced Title ' }])).toEqual({
      'spaced title': 'a',
    })
  })

  it('keeps the first of two notes sharing a title, so resolution is stable', () => {
    const targets = noteLinkTargets([
      { id: 'first', title: 'Same' },
      { id: 'second', title: 'same' },
    ])
    expect(targets['same']).toBe('first')
  })

  it('ignores a blank title rather than keying on an empty string', () => {
    expect(noteLinkTargets([{ id: 'x', title: '   ' }])).toEqual({})
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
