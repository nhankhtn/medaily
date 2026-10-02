/**
 * How often one key may do something. A token bucket, not a window counter —
 * a counter lets twice its limit through across a boundary.
 *
 * Per process, so the real allowance is this times however many instances are
 * warm. It stops casual hammering, not a determined attacker.
 */

export type Allowance = {
  allowed: boolean
  /** Whole tokens left after this one. */
  remaining: number
  /** How long until the next token, for a `Retry-After`. Zero when allowed. */
  retryAfterMs: number
}

export type Limit = {
  /** Spends one token. `now` is injectable so the rule can be tested on a clock. */
  take: (key: string, now?: number) => Allowance
  /** For a success: a correct password says this was never the caller meant. */
  refill: (key: string) => void
}

/** Invented keys can grow the map, and nothing runs on a timer; swept instead. */
const MAX_KEYS = 10_000

export function createLimit({
  capacity,
  refillMs,
}: {
  /** Tokens in a full bucket: the most that may happen back to back. */
  capacity: number
  /** How long a bucket takes to refill from empty. */
  refillMs: number
}): Limit {
  const buckets = new Map<string, { tokens: number; at: number }>()

  // A ratio, not a tokens-per-ms reciprocal: dividing by that put
  // `Retry-After` a millisecond past the true wait.
  const gained = (ms: number) => (Math.max(0, ms) * capacity) / refillMs
  const waitFor = (tokens: number) => (tokens * refillMs) / capacity

  /**
   * A fully refilled bucket answers as one that was never there, so dropping
   * it changes nothing. Past that the oldest go.
   */
  const sweep = (now: number) => {
    for (const [key, bucket] of buckets) {
      if (bucket.tokens + gained(now - bucket.at) >= capacity) buckets.delete(key)
    }
    while (buckets.size > MAX_KEYS) buckets.delete(buckets.keys().next().value as string)
  }

  return {
    take(key, now = Date.now()) {
      const bucket = buckets.get(key)
      // `gained` clamps a negative gap: a clock stepping back over NTP would
      // otherwise take tokens from someone who spent none.
      const tokens = bucket ? Math.min(capacity, bucket.tokens + gained(now - bucket.at)) : capacity

      if (!bucket && buckets.size >= MAX_KEYS) sweep(now)

      // Re-inserted, not updated: a Map ignores insertion order on overwrite,
      // so the sweep would drop the first-seen key, not the longest-idle one.
      buckets.delete(key)

      if (tokens < 1) {
        buckets.set(key, { tokens, at: now })
        return { allowed: false, remaining: 0, retryAfterMs: Math.ceil(waitFor(1 - tokens)) }
      }

      const left = tokens - 1
      buckets.set(key, { tokens: left, at: now })
      return { allowed: true, remaining: Math.floor(left), retryAfterMs: 0 }
    },

    // A key with no bucket is served a full one, so forgetting it is refilling it.
    refill(key) {
      buckets.delete(key)
    },
  }
}
