import type { Snapshot } from './types'

/**
 * Which row a line is about, in words.
 *
 * A diff says what moved and nothing else, so an edit that changed only the
 * amount reads "Sửa giao dịch — 100.000 → 1.000.001" and leaves out the one
 * thing needed to go and find it. The identifying fields are in the snapshot
 * already; they are simply not part of the difference.
 *
 * Worked out when the trail is read, so rows written before this existed get
 * it too.
 */

/** What a person calls the row, in the order they would reach for. */
const NAMES = ['merchant', 'name', 'title', 'category'] as const

/**
 * When it is about. Only fields a person would use to pick one row out of
 * many like it — a transaction's date does that, a habit's start date does
 * not, because a habit is already unique by its name.
 */
const WHEN = ['occurredOn'] as const

/**
 * `Highlands · 15/09/2026`, or whichever half of that the row has.
 *
 * Both halves are used where both exist: a name alone is not enough when
 * there are eleven coffees at the same place, and a date alone is not enough
 * when there were four things bought that day.
 */
export function identify(snapshot: Snapshot | null | undefined): string | null {
  if (!snapshot) return null

  const parts = [first(snapshot, NAMES), first(snapshot, WHEN)].filter(
    (part): part is string => part !== null,
  )
  return parts.length > 0 ? parts.join(' · ') : null
}

function first(snapshot: Snapshot, fields: readonly string[]): string | null {
  for (const field of fields) {
    const value = snapshot[field]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return null
}
