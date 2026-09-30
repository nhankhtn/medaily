/**
 * "Somebody is typing", and the two numbers that keep it honest.
 *
 * This is the one place the realtime layer carries a payload rather than a
 * ring. It has to: there is nothing on the server to go and ask, because
 * typing is not a fact worth storing — it is true for four seconds and then it
 * is a lie. The doorbell next door stays payload-free precisely so that this
 * exception is visible rather than blended in.
 *
 * Pure on purpose. Everything that decides whether a name appears or
 * disappears is here and testable; Firestore only moves the numbers.
 */

/** One person's claim, as it arrives from the transport. */
export type TypingEntry = {
  /** Firebase uid. Rules tie a write to `request.auth.uid`, so it cannot lie. */
  uid: string
  /** When the claim was made, by the claimant's clock. */
  at: number
}

/**
 * How long a claim is believed.
 *
 * Long enough to survive the pause between two words, short enough that a
 * closed laptop stops "typing" before anybody wonders. Nothing deletes these
 * records when a tab dies, so this is the only thing that ends them.
 */
export const TYPING_TTL_MS = 6_000

/**
 * How often a typist re-announces while still typing.
 *
 * Must be comfortably under the TTL or the indicator blinks between renewals.
 * Must also be nowhere near per-keystroke: every announcement is a Firestore
 * write charged to this project and a read to everyone watching, and a fast
 * typist would otherwise bill a hundred of them per message.
 */
export const TYPING_THROTTLE_MS = 3_000

/**
 * Whether to write again, given when this device last wrote.
 *
 * A clock that jumps backwards — a phone correcting itself, a laptop waking —
 * would otherwise leave `lastAt` in the future and silence the typist until
 * real time caught up. Treating the future as "due" costs one extra write.
 */
export function shouldAnnounce(lastAt: number | null, now: number): boolean {
  if (lastAt === null) return true
  if (lastAt > now) return true
  return now - lastAt >= TYPING_THROTTLE_MS
}

/**
 * Who is still typing: fresh claims, never mine, in a stable order.
 *
 * Sorted by uid rather than by time. The list is rendered as names, and names
 * that reorder themselves while two people type read as flicker — the order
 * carries no meaning worth that.
 */
export function activeTypists(entries: TypingEntry[], now: number, me: string | null): string[] {
  return entries
    .filter((entry) => entry.uid !== me)
    // A claim from the future is a clock askew, not a claim about later; the
    // window is symmetric so one does not outlive the other by hours.
    .filter((entry) => Math.abs(now - entry.at) < TYPING_TTL_MS)
    .map((entry) => entry.uid)
    .sort()
}
