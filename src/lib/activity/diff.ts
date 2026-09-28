import { redact } from '@/lib/alerts/redact'
import type { ActivityChange, Snapshot } from './types'

/** Long enough for a merchant or a goal's name, short enough not to be prose. */
const MAX_VALUE = 80

/**
 * A ceiling on how much one row can say. Forty changes are not read by
 * anybody, and forty is the shape a bulk import takes.
 */
const MAX_FIELDS = 12

/**
 * What moved, worked out when the trail is read rather than when it is written.
 *
 * `current` is the row as it stood; `request` is what the action asked for.
 * Which of them is missing says what happened, so the three cases fall out of
 * the data rather than out of the action's name:
 *
 * - **A create** has no `current` — every field it asked for is new.
 * - **A delete** has no `request` — every field it held is going.
 * - **An edit** has both, and reports only the fields that actually differ.
 *
 * An edit compares **the fields the request carried**, never the union of
 * both. A request that says nothing about `merchant` did not ask to clear it,
 * and a diff that reported `"Highlands" → nothing` would be accusing the save
 * of something it never did.
 */
export function diff(current: Snapshot | null, request: Snapshot | null): ActivityChange[] {
  if (!current && !request) return []

  const fields = Object.keys(request ?? current ?? {})
  const changes: ActivityChange[] = []

  for (const field of fields) {
    const from = clean(current?.[field])
    const to = request ? clean(request[field]) : null
    if (from === to) continue
    if (from === null && to === null) continue
    changes.push({ field, from, to })
    if (changes.length === MAX_FIELDS) break
  }

  return changes
}

/**
 * Empty and absent are the same thing here. A field cleared to `''` and a
 * field never filled read identically to a person, and reporting `"" → nothing`
 * as a change is noise nobody asked for.
 */
function clean(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const text = value.trim()
  if (text === '') return null
  // The same treatment a label gets: written by the app, but carrying words a
  // person typed, and a person can paste a token into a merchant field.
  return redact(text).slice(0, MAX_VALUE)
}
