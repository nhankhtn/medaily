import { describe, expect, it } from 'vitest'
import { floorDue } from '@/features/chat/unread-watch'

/**
 * The fallback for when the doorbell never rings.
 *
 * Worth pinning because it is invisible either way: too eager and a forgotten
 * tab polls all day for nobody, too slow and the tab title — which exists for
 * the window somebody is not looking at — has no fallback at all.
 */
const MINUTE = 60_000

describe('floorDue', () => {
  it('asks again after a minute on the tab in front of somebody', () => {
    expect(floorDue({ hidden: false, since: MINUTE })).toBe(true)
  })

  it('waits out the minute rather than asking on the tick before it', () => {
    expect(floorDue({ hidden: false, since: MINUTE - 1 })).toBe(false)
  })

  it('holds off for three minutes on a tab nobody is looking at', () => {
    // The old rule was "never", which left the tab title with no fallback.
    expect(floorDue({ hidden: true, since: 2 * MINUTE })).toBe(false)
    expect(floorDue({ hidden: true, since: 3 * MINUTE })).toBe(true)
  })

  it('still asks for a hidden tab eventually, which is the whole change', () => {
    expect(floorDue({ hidden: true, since: 10 * MINUTE })).toBe(true)
  })

  it('never asks twice for the same moment', () => {
    expect(floorDue({ hidden: false, since: 0 })).toBe(false)
    expect(floorDue({ hidden: true, since: 0 })).toBe(false)
  })
})
