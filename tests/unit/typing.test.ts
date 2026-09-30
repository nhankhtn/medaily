import { describe, expect, it } from 'vitest'
import { inMemoryTyping } from '@/lib/realtime/signal'
import {
  activeTypists,
  shouldAnnounce,
  TYPING_THROTTLE_MS,
  TYPING_TTL_MS,
  type TypingEntry,
} from '@/lib/realtime/typing'

/**
 * The typing indicator is the one place the realtime layer carries something a
 * client reads and the UI draws. Everything that decides whether a name
 * appears or disappears is in these two functions.
 */
const at = (uid: string, when: number): TypingEntry => ({ uid, at: when })

describe('shouldAnnounce', () => {
  it('announces the first keystroke', () => {
    expect(shouldAnnounce(null, 1_000)).toBe(true)
  })

  /**
   * Every announcement is a Firestore write charged to the project and a read
   * to everyone watching. Per keystroke would be a hundred per message.
   */
  it('stays quiet inside the throttle', () => {
    expect(shouldAnnounce(1_000, 1_000 + TYPING_THROTTLE_MS - 1)).toBe(false)
  })

  it('renews once the throttle has passed', () => {
    expect(shouldAnnounce(1_000, 1_000 + TYPING_THROTTLE_MS)).toBe(true)
  })

  /**
   * A phone correcting its clock, or a laptop waking, leaves the last
   * announcement in the future. Waiting for real time to catch up would
   * silence the typist for as long as the jump.
   */
  it('treats a last-announced in the future as due', () => {
    expect(shouldAnnounce(9_000, 1_000)).toBe(true)
  })

  it('renews well inside the window a claim is believed for', () => {
    expect(TYPING_THROTTLE_MS).toBeLessThan(TYPING_TTL_MS)
  })
})

describe('activeTypists', () => {
  const now = 100_000

  it('never reports me back to myself', () => {
    expect(activeTypists([at('me', now), at('you', now)], now, 'me')).toEqual(['you'])
  })

  /**
   * Nothing deletes a claim when a tab dies, so this filter is the only thing
   * that ends one. Without it the last person to stop typing types forever.
   */
  it('forgets a claim older than the window', () => {
    const entries = [at('fresh', now - 1_000), at('stale', now - TYPING_TTL_MS)]
    expect(activeTypists(entries, now, null)).toEqual(['fresh'])
  })

  /** A claim from the future is a clock askew, not a claim about later. */
  it('forgets a claim too far ahead, rather than believing it for hours', () => {
    expect(activeTypists([at('ahead', now + TYPING_TTL_MS)], now, null)).toEqual([])
  })

  /**
   * Sorted by uid, not by time: the list is rendered as names, and names that
   * reorder while two people type read as flicker.
   */
  it('orders stably however the claims arrive', () => {
    const one = activeTypists([at('b', now), at('a', now - 1)], now, null)
    const other = activeTypists([at('a', now - 1), at('b', now)], now, null)
    expect(one).toEqual(['a', 'b'])
    expect(one).toEqual(other)
  })

  it('reports nobody when nobody has claimed', () => {
    expect(activeTypists([], now, 'me')).toEqual([])
  })
})

describe('inMemoryTyping', () => {
  it('delivers a claim to whoever is watching', async () => {
    const transport = inMemoryTyping('me')
    const seen: TypingEntry[][] = []
    transport.watch('room', (entries) => seen.push(entries))

    await transport.announce('room')
    expect(seen.at(-1)?.map((entry) => entry.uid)).toEqual(['me'])
  })

  /**
   * Sending a message retracts the claim. Letting it time out instead would
   * leave a name marked as typing beside the message that had already arrived.
   */
  it('takes a claim back', async () => {
    const transport = inMemoryTyping('me')
    const seen: TypingEntry[][] = []
    transport.watch('room', (entries) => seen.push(entries))

    await transport.announce('room')
    await transport.retract('room')
    expect(seen.at(-1)).toEqual([])
  })

  it('stops delivering once the watcher has let go', async () => {
    const transport = inMemoryTyping('me')
    let calls = 0
    const stop = transport.watch('room', () => {
      calls += 1
    })

    await transport.announce('room')
    stop()
    await transport.announce('room')
    expect(calls).toBe(1)
  })
})
