import { describe, expect, it } from 'vitest'
import {
  decide,
  enqueue,
  isPermanentFailure,
  MAX_PENDING,
  type PendingSave,
} from '@/lib/offline/pending'

/**
 * The queue holds days someone logged with no signal. Losing an entry loses
 * their evening; replaying a stale one overwrites the correction they made
 * afterwards. Both rules are here rather than inside the hook so they can be
 * tested without a browser.
 */
const save = (date: string, queuedAt: number, energy = 5): PendingSave => ({
  date,
  patch: { energy },
  custom: {},
  queuedAt,
})

describe('enqueue', () => {
  it('keeps one entry per day, the newest', () => {
    const list = enqueue(enqueue([], save('2026-09-18', 1, 5)), save('2026-09-18', 2, 9))

    expect(list).toHaveLength(1)
    expect(list[0]?.patch).toEqual({ energy: 9 })
  })

  it('keeps different days apart', () => {
    const list = enqueue(enqueue([], save('2026-09-17', 1)), save('2026-09-18', 2))
    expect(list.map((entry) => entry.date)).toEqual(['2026-09-17', '2026-09-18'])
  })

  it('orders oldest first, whatever order they arrived in', () => {
    const list = enqueue(enqueue([], save('2026-09-18', 20)), save('2026-09-17', 10))
    expect(list.map((entry) => entry.queuedAt)).toEqual([10, 20])
  })

  /**
   * A queue this long is not a busy week, it is a sync that has stopped
   * working — and the recent days are the ones still worth sending.
   */
  it('caps the queue by dropping the oldest', () => {
    let list: PendingSave[] = []
    for (let i = 0; i < MAX_PENDING + 5; i++) {
      list = enqueue(list, save(`day-${i}`, i))
    }

    expect(list).toHaveLength(MAX_PENDING)
    expect(list[0]?.date).toBe('day-5')
    expect(list.at(-1)?.date).toBe(`day-${MAX_PENDING + 4}`)
  })
})

describe('isPermanentFailure', () => {
  /**
   * Without this the first unsendable entry blocks every good one behind it,
   * retried on every reconnect for as long as the app is installed.
   */
  it('gives up on a rejection that will never pass', () => {
    expect(isPermanentFailure('invalid_input')).toBe(true)
    expect(isPermanentFailure('future_date')).toBe(true)
    expect(isPermanentFailure('too_short')).toBe(true)
  })

  it('keeps anything that might just be the network', () => {
    expect(isPermanentFailure('offline')).toBe(false)
    expect(isPermanentFailure('fetch failed')).toBe(false)
    expect(isPermanentFailure('')).toBe(false)
  })
})

describe('decide', () => {
  it('drops a day the server accepted', () => {
    expect(decide({ ok: true })).toBe('sent')
  })

  /**
   * `null` is the action throwing, which is what no network looks like. Losing
   * this branch would delete the evening someone logged on the metro.
   */
  it('keeps a day when the call never reached the server', () => {
    expect(decide(null)).toBe('stop')
  })

  it('drops a day the server will never accept', () => {
    expect(decide({ ok: false, error: 'invalid_input' })).toBe('dropped')
    expect(decide({ ok: false, error: 'future_date' })).toBe('dropped')
  })

  /**
   * Anything else might be a gateway having a bad minute. Dropping on it would
   * throw away a real day; retrying forever is the failure the `dropped`
   * branch above exists to prevent, and only for errors known to be final.
   */
  it('keeps a day on a rejection it does not recognise', () => {
    expect(decide({ ok: false, error: 'rate_limited' })).toBe('stop')
    expect(decide({ ok: false, error: '' })).toBe('stop')
  })
})
