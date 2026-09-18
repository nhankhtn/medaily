import { describe, expect, it } from 'vitest'
import { createLimit } from '@/lib/rate-limit'

/** Eight per fifteen minutes, the sign-in rule, at a readable scale. */
const MINUTE = 60_000
const signIns = () => createLimit({ capacity: 8, refillMs: 15 * MINUTE })

/** Spends `count` tokens starting at `from`, all at the same instant. */
function drain(limit: ReturnType<typeof createLimit>, key: string, count: number, from = 0) {
  return Array.from({ length: count }, () => limit.take(key, from))
}

describe('a bucket', () => {
  it('lets a full bucket through back to back, then stops', () => {
    const limit = signIns()
    expect(drain(limit, 'ip', 8).every((take) => take.allowed)).toBe(true)
    expect(limit.take('ip', 0).allowed).toBe(false)
  })

  it('counts down what is left', () => {
    const limit = signIns()
    expect(limit.take('ip', 0).remaining).toBe(7)
    expect(limit.take('ip', 0).remaining).toBe(6)
  })

  it('hands back one token per refill slice, not the whole bucket at once', () => {
    const limit = signIns()
    drain(limit, 'ip', 8)

    // A token every 112.5 seconds, so at 112 there is not one yet.
    expect(limit.take('ip', 112_000).allowed).toBe(false)
    expect(limit.take('ip', 113_000).allowed).toBe(true)
    // And that one token is all there was.
    expect(limit.take('ip', 113_000).allowed).toBe(false)
  })

  it('says how long the wait is, which is what a Retry-After needs', () => {
    const limit = signIns()
    drain(limit, 'ip', 8)

    const refused = limit.take('ip', 0)
    expect(refused.retryAfterMs).toBe(112_500)
    // Half way there, half the wait left.
    expect(limit.take('ip', 56_250).retryAfterMs).toBe(56_250)
  })

  it('does not bank tokens while nobody is asking', () => {
    const limit = signIns()
    drain(limit, 'ip', 8)

    // A day of quiet still only fills the bucket.
    limit.take('ip', 24 * 60 * MINUTE)
    expect(drain(limit, 'ip', 7, 24 * 60 * MINUTE).every((take) => take.allowed)).toBe(true)
    expect(limit.take('ip', 24 * 60 * MINUTE).allowed).toBe(false)
  })

  it('keeps one key out of another`s way', () => {
    const limit = signIns()
    drain(limit, 'first', 8)

    expect(limit.take('first', 0).allowed).toBe(false)
    expect(limit.take('second', 0).allowed).toBe(true)
  })

  it('gives nothing away to a clock that steps backwards', () => {
    const limit = signIns()
    drain(limit, 'ip', 8)
    expect(limit.take('ip', -60 * MINUTE).allowed).toBe(false)
  })
})

/**
 * The reason this is a bucket and not a counter per window. A window counter
 * lets a caller spend its whole allowance at the end of one window and the
 * whole of the next allowance a moment later — sixteen tries in two seconds,
 * against a limit of eight per quarter hour.
 */
describe('the boundary a window counter leaks at', () => {
  it('never lets twice the allowance through in a moment', () => {
    const limit = signIns()
    const windowEnd = 15 * MINUTE

    drain(limit, 'ip', 8, windowEnd - 1_000)
    const justAfter = drain(limit, 'ip', 8, windowEnd + 1_000)

    // Two seconds of refill is a fraction of a token, so none of these land.
    expect(justAfter.some((take) => take.allowed)).toBe(false)
  })
})

describe('refill', () => {
  it('puts a drained bucket back, for a caller that has proved itself', () => {
    const limit = signIns()
    drain(limit, 'ip', 8)
    expect(limit.take('ip', 0).allowed).toBe(false)

    limit.refill('ip')
    expect(drain(limit, 'ip', 8).every((take) => take.allowed)).toBe(true)
  })
})

describe('the map it keeps', () => {
  it('forgets an old bucket rather than growing without end', () => {
    const limit = createLimit({ capacity: 2, refillMs: 60 * MINUTE })
    limit.take('old', 0)
    limit.take('old', 0)
    expect(limit.take('old', 0).allowed).toBe(false)

    // Enough other keys to push it out. Each holds a part-spent bucket, so the
    // sweep cannot drop those and has to drop the oldest instead.
    for (let i = 0; i < 10_001; i++) limit.take(`flood-${i}`, 0)

    // Forgiven, which is the trade: bounded memory, and no weaker than before,
    // since inventing keys already buys a fresh bucket per key.
    expect(limit.take('old', 0).allowed).toBe(true)
  })

  it('does not forgive a key that keeps knocking', () => {
    const limit = createLimit({ capacity: 2, refillMs: 60 * MINUTE })
    limit.take('keen', 0)
    limit.take('keen', 0)

    // The one that matters: someone being held back who carries on trying must
    // not be swept out and handed a fresh bucket. Each refused try counts as
    // use, which keeps them at the back of the queue for eviction.
    for (let i = 0; i < 10_001; i++) {
      limit.take(`flood-${i}`, 0)
      if (i % 100 === 0) expect(limit.take('keen', 0).allowed).toBe(false)
    }

    expect(limit.take('keen', 0).allowed).toBe(false)
  })
})
