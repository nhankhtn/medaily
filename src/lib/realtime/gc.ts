/**
 * What the nightly sweep may delete. Pure, so it can be asserted — see
 * docs/reference/realtime/housekeeping.md for why the thresholds can be this blunt.
 */

/** A month of silence means a rotated key or a deleted room, not a quiet one. */
export const CHANNEL_STALE_MS = 30 * 24 * 60 * 60 * 1000

/** Believed for 6s; the hour is room for a device whose clock is wrong. */
export const TYPING_STALE_MS = 60 * 60 * 1000

/** A blast radius, not a performance limit. */
export const MAX_DELETES_PER_RUN = 500

/**
 * How many channels one run looks inside.
 *
 * Each needs its own listing of the typing claims under it — a sub-collection
 * cannot be read without naming its parent — so this is the read budget the
 * delete cap does not cover. Past it the sweep would be one request per
 * channel every night whether or not anything was there to remove.
 *
 * Sorted by name, so a run that stops here stops in the same place each time.
 * If the collection ever outgrows this, the sweep needs a collection-group
 * query rather than a larger number.
 */
export const MAX_CHANNELS_PER_RUN = 1_000

export type SweepDoc = {
  /** Full Firestore document path, as the REST API names it. */
  path: string
  /** The `at` field, or `null` when missing or not a number. */
  at: number | null
}

/**
 * A document with no readable `at` is **kept**: "delete what you do not
 * understand" is the wrong default for a scheduled job. It is reported as
 * skipped instead.
 */
export function isStale(doc: SweepDoc, now: number, olderThanMs: number): boolean {
  if (doc.at === null) return false
  // A future timestamp is a clock askew, not a reason to keep it that long.
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

  // Sorted so a run cut off by the cap takes the same half every night.
  return { paths: paths.sort(), skipped }
}

/**
 * `integerValue` arrives as a **string** (JSON holds no 64-bit int) and a
 * fractional one as `doubleValue`. Reading only one makes every document look
 * unexplained and the sweep delete nothing, quietly.
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
