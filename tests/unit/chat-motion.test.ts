import { describe, expect, it } from 'vitest'
import {
  bubbleCorners,
  easterEggOf,
  grownReaction,
  swipeIntent,
  unreadStart,
} from '@/features/chat/motion'

describe('easterEggOf', () => {
  it('finds congratulations with or without the marks', () => {
    expect(easterEggOf('Chúc mừng nha!')).toBe('confetti')
    expect(easterEggOf('chuc mung')).toBe('confetti')
    expect(easterEggOf('CONGRATS!!')).toBe('confetti')
    expect(easterEggOf('Congratulations')).toBe('confetti')
  })

  it('prefers balloons when the wish is a birthday one', () => {
    expect(easterEggOf('Happy birthday 🎂')).toBe('balloons')
    expect(easterEggOf('Sinh nhật vui vẻ nhé')).toBe('balloons')
    // Contains "chúc mừng" too; the birthday wins.
    expect(easterEggOf('Chúc mừng sinh nhật!')).toBe('balloons')
  })

  it('leaves ordinary messages alone', () => {
    expect(easterEggOf('mai gặp nhé')).toBeNull()
    expect(easterEggOf('')).toBeNull()
  })
})

describe('bubbleCorners', () => {
  it('tucks only the tail corner of a run opener', () => {
    expect(bubbleCorners({ mine: true, startsRun: true })).toBe('rounded-br-md')
    expect(bubbleCorners({ mine: false, startsRun: true })).toBe('rounded-bl-md')
  })

  it('tucks both tail-side corners further down a run', () => {
    expect(bubbleCorners({ mine: true, startsRun: false })).toBe('rounded-r-md')
    expect(bubbleCorners({ mine: false, startsRun: false })).toBe('rounded-l-md')
  })
})

describe('unreadStart', () => {
  const rows = [
    { id: '1', userId: 'a' },
    { id: '2', userId: 'me' },
    { id: '3', userId: 'me' },
    { id: '4', userId: 'b' },
    { id: '5', userId: 'a' },
  ]

  it('starts at the first message from somebody else after my mark', () => {
    expect(unreadStart(rows, '1', 'me')).toEqual({ id: '4', count: 2 })
  })

  it('draws nothing when everything after the mark is mine, or nothing follows', () => {
    expect(unreadStart(rows.slice(0, 3), '1', 'me')).toBeNull()
    expect(unreadStart(rows, '5', 'me')).toBeNull()
  })

  it('draws nothing when the mark is missing or not on this page', () => {
    expect(unreadStart(rows, null, 'me')).toBeNull()
    expect(unreadStart(rows, 'older', 'me')).toBeNull()
  })
})

describe('grownReaction', () => {
  it('names the reaction whose count went up', () => {
    expect(grownReaction({ '👍': 1 }, { '👍': 2 })).toBe('👍')
    expect(grownReaction({}, { '❤️': 1 })).toBe('❤️')
  })

  it('ignores reactions that stayed or shrank', () => {
    expect(grownReaction({ '👍': 2 }, { '👍': 1 })).toBeNull()
    expect(grownReaction({ '👍': 1 }, { '👍': 1 })).toBeNull()
  })
})

describe('swipeIntent', () => {
  it('waits until the thumb has moved', () => {
    expect(swipeIntent(-3, 2)).toBeNull()
  })

  it('reads a mostly leftward drag as a swipe and anything else as a scroll', () => {
    expect(swipeIntent(-30, 5)).toBe('swipe')
    expect(swipeIntent(-20, 18)).toBe('scroll')
    expect(swipeIntent(30, 0)).toBe('scroll')
    expect(swipeIntent(0, 30)).toBe('scroll')
  })
})
