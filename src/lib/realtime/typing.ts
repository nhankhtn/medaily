/**
 * "Somebody is typing" — the one place this layer carries a payload rather
 * than a ring, because there is nothing on the server to go and ask.
 * See docs/reference/realtime/typing-indicator.md.
 */

/** One person's claim, as it arrives from the transport. */
export type TypingEntry = {
  /** Firebase uid. Rules tie a write to `request.auth.uid`, so it cannot lie. */
  uid: string
  /** When the claim was made, by the claimant's clock. */
  at: number
}

/** Nothing deletes a claim when a tab dies, so this is what ends them. */
export const TYPING_TTL_MS = 6_000

/** Under the TTL so it does not blink; far from per-keystroke so it is cheap. */
export const TYPING_THROTTLE_MS = 3_000

/**
 * A clock that jumps backwards would leave `lastAt` in the future and silence
 * the typist, so the future counts as due.
 */
export function shouldAnnounce(lastAt: number | null, now: number): boolean {
  if (lastAt === null) return true
  if (lastAt > now) return true
  return now - lastAt >= TYPING_THROTTLE_MS
}

/**
 * Fresh claims, never mine, sorted by uid — names that reorder while two
 * people type read as flicker.
 */
export function activeTypists(entries: TypingEntry[], now: number, me: string | null): string[] {
  return (
    entries
      .filter((entry) => entry.uid !== me)
      // Symmetric: a claim from the future is a clock askew, not one about later.
      .filter((entry) => Math.abs(now - entry.at) < TYPING_TTL_MS)
      .map((entry) => entry.uid)
      .sort()
  )
}
