import { describe, expect, it } from 'vitest'
import { onlyEmoji } from '@/lib/chat/only-emoji'

/**
 * A message that is nothing but emoji is drawn large, the way every chat app
 * draws one. The rule has to be narrow, because the alternative is shouting
 * somebody's phone number across the room — which is what the first version
 * did: `Emoji_Component` includes the digits 0-9, since those are what keycap
 * emoji are built out of.
 */
describe('deciding a message is all emoji', () => {
  it.each([['👍'], ['🎉🎉🎉'], ['❤️'], ['👍 🎉'], ['👨‍👩‍👧']])('draws %s large', (body) => {
    expect(onlyEmoji(body)).toBe(true)
  })

  it.each([
    ['32434343', 'a number somebody typed'],
    ['123', 'a short number'],
    ['#', 'a keycap base on its own'],
    ['*', 'the other keycap base'],
    ['ok 👍', 'a word beside an emoji'],
    ['xin chào', 'ordinary words'],
    ['', 'nothing'],
    ['   ', 'only spaces'],
  ])('leaves %j alone — %s', (body) => {
    expect(onlyEmoji(body)).toBe(false)
  })

  /** Long enough to be a paragraph of emoji is long enough to read normally. */
  it('stops at a run too long to be a reaction', () => {
    expect(onlyEmoji('🎉'.repeat(40))).toBe(false)
  })
})
