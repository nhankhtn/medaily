/**
 * What the nightly sweep is allowed to delete.
 *
 * Nothing here talks to Firestore. A job that deletes production data on a
 * schedule is worth being able to assert about, and the assertions are worth
 * more than the plumbing — so every decision lives in these functions and the
 * service only carries them out.
 *
 * Deleting from here is unusually safe, which is the reason the thresholds can
 * be blunt: a channel document holds a counter and a time, and the next `ring`
 * re-creates whatever it needs with `setDoc(..., { merge: true })`. The worst
 * a wrong deletion costs is one message arriving on the 45-second floor
 * instead of instantly. There is nothing to lose because nothing is stored.
 */

/**
 * How long a channel document is left alone.
 *
 * A month of silence means a rotated key or a deleted room far more often than
 * a room somebody is about to open. Deleting a live room's doorbell would be
 * harmless but pointless, and the threshold is what keeps the sweep away from
 * rooms in use.
 */
export const CHANNEL_STALE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * How long a typing claim is left alone.
 *
 * Believed for six seconds, swept after an hour. The gap is not caution about
 * the TTL — it is room for a device whose clock is wrong, which is the same
 * device whose writes the rules are already rejecting.
 */
export const TYPING_STALE_MS = 60 * 60 * 1000

/**
 * The most this job will delete in one night.
 *
 * Not a performance limit — a blast radius. A mistake in a threshold, or a
 * clock that reads years ahead, should cost a bounded number of rows and a
 * confusing line in the report, not the collection.
 */
export const MAX_DELETES_PER_RUN = 500

/** One document, reduced to the two things the decision needs. */
export type SweepDoc = {
  /** Full Firestore document path, as the REST API names it. */
  path: string
  /** The `at` field, or `null` when it is missing or not a number. */
  at: number | null
}

/**
 * Whether this document is old enough to remove.
 *
 * A document with no readable `at` is **kept**. It is unexplained — written by
 * a version of this app that no longer exists, or by hand — and "delete what
 * you do not understand" is the wrong default for a scheduled job. It shows up
 * in the report as skipped instead, which is how anyone would find out it
 * exists at all.
 */
export function isStale(doc: SweepDoc, now: number, olderThanMs: number): boolean {
  if (doc.at === null) return false
  // A timestamp in the future is a clock askew, not a document to keep for
  // however long the skew lasts.
  return Math.abs(now - doc.at) >= olderThanMs
}

/** The paths to delete, and the count that could not be judged. */
export function selectStale(
  docs: SweepDoc[],
  now: number,
  olderThanMs: number,
): { paths: string[]; skipped: number } {
  const paths: string[] = []
  let skipped = 0

  for (const doc of docs) {
    if (doc.at === null) {
      skipped += 1
      continue
    }
    if (isStale(doc, now, olderThanMs)) paths.push(doc.path)
  }

  // Sorted so two runs over the same data delete in the same order, and a run
  // cut off by the cap removes a predictable half rather than an arbitrary one.
  return { paths: paths.sort(), skipped }
}

/**
 * Reads the `at` field out of a Firestore REST document.
 *
 * `integerValue` arrives as a **string** — JSON cannot hold a 64-bit integer —
 * and a whole number written by the browser SDK comes back that way, while a
 * fractional one comes back as `doubleValue`. Reading only one of the two
 * would make every document look unexplained and the sweep delete nothing,
 * quietly, forever.
 */
export function readAt(fields: unknown): number | null {
  if (typeof fields !== 'object' || fields === null) return null
  const at = (fields as Record<string, unknown>).at
  if (typeof at !== 'object' || at === null) return null

  const value = at as { integerValue?: unknown; doubleValue?: unknown }
  if (typeof value.integerValue === 'string') {
    const parsed = Number(value.integerValue)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value.doubleValue === 'number' && Number.isFinite(value.doubleValue)) {
    return value.doubleValue
  }
  return null
}
