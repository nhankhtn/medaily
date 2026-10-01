import { describe, expect, it } from 'vitest'
import { notificationFor } from '@/server/services/chat-notify'

/**
 * What lands on a lock screen. Worth asserting because it is read by someone
 * who has not opened the app and cannot ask a follow-up question — and because
 * one of these branches would otherwise put a sticker's internal id there as
 * though it were what somebody said.
 */
describe('notificationFor', () => {
  it('puts the room name on top and names who spoke', () => {
    const shown = notificationFor({ kind: 'text', body: 'mai họp 9h', title: 'Nhóm dự án', who: 'Nam' })
    expect(shown.title).toBe('Nhóm dự án')
    expect(shown.body).toBe('Nam: mai họp 9h')
  })

  /**
   * A conversation with one other person has no title of its own, so the
   * person becomes the title — and naming them again in the body would be
   * saying it twice.
   */
  it('uses the sender as the title where the room has none', () => {
    const shown = notificationFor({ kind: 'text', body: 'ăn trưa chưa', title: null, who: 'Nam' })
    expect(shown.title).toBe('Nam')
    expect(shown.body).toBe('ăn trưa chưa')
  })

  /** A sticker's body is an id. `coffee` on a lock screen is not a message. */
  it('never shows a sticker id as though it were words', () => {
    const shown = notificationFor({ kind: 'sticker', body: 'coffee', title: null, who: 'Nam' })
    expect(shown.body).not.toContain('coffee')
  })

  it('flattens a message that was typed across several lines', () => {
    const shown = notificationFor({ kind: 'text', body: 'một\n\nhai   ba', title: null, who: null })
    expect(shown.body).toBe('một hai ba')
  })

  it('trims a long message rather than filling the screen with it', () => {
    const shown = notificationFor({ kind: 'text', body: 'x'.repeat(500), title: null, who: null })
    expect(shown.body.length).toBeLessThanOrEqual(140)
    expect(shown.body.endsWith('…')).toBe(true)
  })

  /** A deploy with no display name should still say something. */
  it('falls back to the app name when there is nothing to call it', () => {
    expect(notificationFor({ kind: 'text', body: 'chào', title: null, who: null }).title).toBe(
      'medaily',
    )
  })
})
