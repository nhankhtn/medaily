import { describe, expect, it } from 'vitest'
import { matches, normalise } from '@/lib/chat/search'

/**
 * What "found" means, in a language where most people type without the marks.
 *
 * There is no index behind this and no database collation to appeal to —
 * bodies are sealed at rest, so this comparison is the entire search. Every
 * way it can be wrong is a message somebody cannot find again.
 */
describe('normalise', () => {
  it('takes the marks off, so a word typed plainly still matches', () => {
    expect(normalise('họp')).toBe('hop')
    expect(normalise('Nhắn tin')).toBe('nhan tin')
  })

  it('handles đ, which NFD leaves alone because it is its own letter', () => {
    // The one Vietnamese letter that is not a vowel wearing a mark.
    expect(normalise('đã')).toBe('da')
    expect(normalise('ĐƯỢC')).toBe('duoc')
  })

  it('folds case', () => {
    expect(normalise('MAI Họp')).toBe('mai hop')
  })

  it('collapses runs of space, which a paste brings along', () => {
    expect(normalise('  mai\n\thop  ')).toBe('mai hop')
  })

  it('leaves what is already plain untouched', () => {
    expect(normalise('mai hop 9h')).toBe('mai hop 9h')
  })
})

describe('matches', () => {
  it('finds a word typed without its marks', () => {
    expect(matches('mai họp 9h nhé', 'hop')).toBe(true)
  })

  it('finds a word typed with them', () => {
    expect(matches('mai họp 9h nhé', 'họp')).toBe(true)
  })

  it('finds part of a word, which is what somebody has mid-thought', () => {
    expect(matches('đang chuẩn bị tài liệu', 'chuan')).toBe(true)
  })

  it('says no when the word is not there', () => {
    expect(matches('mai họp 9h', 'tien')).toBe(false)
  })

  it('never answers yes to nothing', () => {
    // An empty box should show no results, not every message in the room.
    expect(matches('bất cứ gì', '')).toBe(false)
    expect(matches('bất cứ gì', '   ')).toBe(false)
  })

  it('does not confuse two words for the phrase they are not', () => {
    expect(matches('họp mai', 'mai hop')).toBe(false)
  })
})
