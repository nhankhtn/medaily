import { describe, expect, it } from 'vitest'
import {
  CHANNEL_STALE_MS,
  isStale,
  MAX_DELETES_PER_RUN,
  readAt,
  selectStale,
  TYPING_STALE_MS,
  type SweepDoc,
} from '@/lib/realtime/gc'

/**
 * These rules decide what a scheduled job deletes from production. Deleting
 * from here is unusually safe — a channel document holds a counter and the next
 * ring re-creates it — but "safe" is the reason the thresholds can be blunt,
 * not a reason to leave them unasserted.
 */
const doc = (path: string, at: number | null): SweepDoc => ({ path, at })

describe('isStale', () => {
  const now = 1_000_000_000

  it('removes a document past the threshold', () => {
    expect(isStale(doc('a', now - TYPING_STALE_MS), now, TYPING_STALE_MS)).toBe(true)
  })

  it('leaves one inside the threshold alone', () => {
    expect(isStale(doc('a', now - TYPING_STALE_MS + 1), now, TYPING_STALE_MS)).toBe(false)
  })

  /**
   * The alternative is keeping it for however long the skew lasts — and a
   * clock years ahead would mean forever.
   */
  it('removes one dated in the future by more than the threshold', () => {
    expect(isStale(doc('a', now + TYPING_STALE_MS), now, TYPING_STALE_MS)).toBe(true)
  })

  /**
   * "Delete what you do not understand" is the wrong default for a scheduled
   * job. A document written by a version of the app that no longer exists is
   * reported, not removed.
   */
  it('keeps a document whose timestamp cannot be read', () => {
    expect(isStale(doc('a', null), now, TYPING_STALE_MS)).toBe(false)
  })

  it('treats a channel far more patiently than a typing claim', () => {
    expect(CHANNEL_STALE_MS).toBeGreaterThan(TYPING_STALE_MS)
  })
})

describe('selectStale', () => {
  const now = 1_000_000_000

  it('separates what goes from what cannot be judged', () => {
    const result = selectStale(
      [
        doc('old', now - TYPING_STALE_MS * 2),
        doc('fresh', now - 1_000),
        doc('unreadable', null),
      ],
      now,
      TYPING_STALE_MS,
    )

    expect(result.paths).toEqual(['old'])
    expect(result.skipped).toBe(1)
  })

  /**
   * A run cut off by the cap takes the first half of a sorted list, which is
   * the same half every night until it is done. Unsorted, it would take an
   * arbitrary half and could revisit the same documents forever.
   */
  it('orders the deletions, so a capped run makes progress', () => {
    const old = now - TYPING_STALE_MS * 2
    const result = selectStale([doc('c', old), doc('a', old), doc('b', old)], now, TYPING_STALE_MS)
    expect(result.paths).toEqual(['a', 'b', 'c'])
  })

  it('finds nothing to do in an empty collection', () => {
    expect(selectStale([], now, TYPING_STALE_MS)).toEqual({ paths: [], skipped: 0 })
  })

  it('has a blast radius', () => {
    expect(MAX_DELETES_PER_RUN).toBeGreaterThan(0)
    expect(MAX_DELETES_PER_RUN).toBeLessThanOrEqual(5_000)
  })
})

describe('readAt', () => {
  /**
   * JSON cannot hold a 64-bit integer, so the REST API sends one as a string.
   * Reading only `doubleValue` would make every document look unexplained and
   * the sweep delete nothing — quietly, forever.
   */
  it('reads an integer, which arrives as a string', () => {
    expect(readAt({ at: { integerValue: '1750000000000' } })).toBe(1_750_000_000_000)
  })

  it('reads a double, which does not', () => {
    expect(readAt({ at: { doubleValue: 1_750_000_000_000.5 } })).toBe(1_750_000_000_000.5)
  })

  it('reports nothing readable rather than guessing', () => {
    expect(readAt(undefined)).toBeNull()
    expect(readAt({})).toBeNull()
    expect(readAt({ at: {} })).toBeNull()
    expect(readAt({ at: { stringValue: 'yesterday' } })).toBeNull()
    expect(readAt({ at: { integerValue: 'not a number' } })).toBeNull()
    expect(readAt({ other: { integerValue: '1' } })).toBeNull()
  })
})
