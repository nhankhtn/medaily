import { describe, expect, it } from 'vitest'
import { tabTitle } from '@/features/chat/tab-title'
import { faceFor } from '@/server/services/chat-notify'

/**
 * The two places a conversation shows up without the app being open.
 *
 * Both run where nothing else can see them — a browser tab and a lock screen —
 * so both are kept pure and asserted here rather than looked at once and
 * trusted.
 */
describe('tabTitle', () => {
  const base = 'Personal OS'

  it('says who wrote, when there is one name to say', () => {
    expect(tabTitle({ base, count: 1, messaged: 'Nhân đã nhắn tin cho bạn' })).toBe(
      'Nhân đã nhắn tin cho bạn',
    )
  })

  it('counts instead when several rooms are waiting', () => {
    // Naming whoever wrote last would say a smaller thing than the number and
    // sound like the whole of it.
    expect(tabTitle({ base, count: 3, messaged: null })).toBe('(3) Personal OS')
  })

  it('gives the page its own name back when nothing is waiting', () => {
    expect(tabTitle({ base, count: 0, messaged: 'Nhân đã nhắn tin cho bạn' })).toBe('Personal OS')
  })

  it('treats a count that is somehow negative as nothing waiting', () => {
    expect(tabTitle({ base, count: -1, messaged: null })).toBe('Personal OS')
  })

  it('leaves the page title alone rather than decorating it twice', () => {
    // The component keeps the page's own title and rebuilds from it, so this
    // is never handed its own output to parse back apart.
    const once = tabTitle({ base, count: 2, messaged: null })
    expect(tabTitle({ base, count: 0, messaged: null })).toBe(base)
    expect(once).toBe('(2) Personal OS')
  })
})

describe('faceFor', () => {
  it('prefers the room, which is what the notification opens', () => {
    expect(faceFor({ avatarUrl: 'https://img/room.png', senderImage: 'https://img/me.png' })).toBe(
      'https://img/room.png',
    )
  })

  it('falls back to the sender, because a direct room has no face of its own', () => {
    expect(faceFor({ avatarUrl: null, senderImage: 'https://img/me.png' })).toBe(
      'https://img/me.png',
    )
  })

  it('says nothing when there is neither, so the worker draws the app icon', () => {
    expect(faceFor({ avatarUrl: null, senderImage: null })).toBeUndefined()
  })

  it('refuses anything but https, which the browser would go and fetch', () => {
    expect(faceFor({ avatarUrl: 'http://img/room.png', senderImage: null })).toBeUndefined()
    expect(faceFor({ avatarUrl: 'javascript:alert(1)', senderImage: null })).toBeUndefined()
  })

  it('skips an unusable room picture rather than dropping the sender too', () => {
    expect(faceFor({ avatarUrl: 'http://img/room.png', senderImage: 'https://img/me.png' })).toBe(
      'https://img/me.png',
    )
  })
})
