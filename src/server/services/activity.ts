import { after } from 'next/server'
import { redact } from '@/lib/alerts/redact'
import { pickActivityStore } from '@/lib/activity/provider'
import type { ActivityStore } from '@/lib/activity/store'
import { isAudited } from '@/lib/activity/registry'
import { diff } from '@/lib/activity/diff'
import { identify } from '@/lib/activity/identity'
import {
  entityOf,
  type ActivityAction,
  type ActivityFeed,
  type Snapshot,
} from '@/lib/activity/types'
import { currentRequestId, log } from '@/lib/log'

/** A label is a name, not a payload. Anything longer is being misused. */
const MAX_LABEL = 120

/** One page of the trail. Long enough to cover a busy day on one screen. */
export const ACTIVITY_PAGE = 50

export { activityLogEnabled } from '@/lib/activity/provider'

/**
 * Every function here takes its store as an argument, defaulting to whichever
 * one is configured — the same shape the repositories use for a transaction
 * handle (`tx: DbOrTx = db`). A test hands in `inMemoryActivityStore()` and
 * needs no mocking framework; production hands in nothing and gets Mongo.
 */
type WithStore = { store?: ActivityStore }

/**
 * Notes that something changed.
 *
 * Two rules, and they are the whole design:
 *
 * **It never throws.** A log write that fails must not fail the delete it was
 * watching — the rule `alerts.ts` follows, for the same reason. Errors end in
 * the console and nowhere else.
 *
 * **It never blocks.** `after()` runs it once the response is on its way, so
 * recording a transaction costs the person who recorded it nothing. A slow
 * store makes the trail late, not the app.
 *
 * The cost of those two: this is a best-effort trail, not a ledger. A store
 * that is down when you delete something loses that line. Anything needing a
 * guarantee belongs in the same transaction as the change itself, which is a
 * different design and a slower one.
 */
export function recordActivity(
  entry: {
    userId: string
    action: ActivityAction
    entityId?: string | null
    label?: string | null
    current?: Snapshot | null
    request?: Snapshot | null
  },
  { store = pickActivityStore() }: WithStore = {},
): void {
  // The registry is checked here rather than at each call site, because here
  // is the one line every recorded action goes through. Sign-in is written by
  // hand — `audited()` cannot wrap it, there being no session to read before
  // one exists — and a switch that half the writers ignore is not a switch.
  if (!isAudited(entityOf(entry.action))) return

  // Read inside the request: `after()` runs once the headers are gone.
  const requestIdPromise = currentRequestId()

  after(async () => {
    try {
      await store.append({
        userId: entry.userId,
        at: new Date(),
        action: entry.action,
        entityId: entry.entityId ?? null,
        // The same redaction an exception gets. A label is written by the app
        // rather than typed by a person, but it carries a person's words — a
        // merchant, a habit's name — and those are theirs.
        label: entry.label ? redact(entry.label).slice(0, MAX_LABEL) : null,
        requestId: await requestIdPromise,
        // Stored as handed over. Reducing them to a difference here would
        // throw away the facts and keep only this deploy's reading of them.
        current: entry.current ?? null,
        request: entry.request ?? null,
      })
    } catch (error) {
      await log.error('activity', 'could not record an action', error)
    }
  })
}

/**
 * One page of this person's trail. Scoped by `userId` inside the store rather
 * than filtered afterwards: a log is personal data, and the rule that nobody
 * reads anybody else's holds in the second database too.
 */
export async function findActivity(
  userId: string,
  {
    cursor,
    limit = ACTIVITY_PAGE,
    store = pickActivityStore(),
  }: WithStore & {
    cursor?: string | null
    limit?: number
  } = {},
): Promise<ActivityFeed> {
  try {
    const page = await store.list(userId, { cursor, limit: Math.min(limit, ACTIVITY_PAGE) })
    return {
      // Worked out here rather than stored, so a row written months ago is
      // read by today's rules — a renamed field or a better comparison
      // reaches the whole trail, not just what happens after the deploy.
      items: page.items.map((row) => ({
        ...row,
        // What it was rather than what it became: an edit is looked up by the
        // row you remember, not by the row it has just turned into.
        label: identify(row.current ?? row.request) ?? row.label,
        changes: diff(row.current, row.request),
      })),
      nextCursor: page.nextCursor,
    }
  } catch (error) {
    // The trail is a convenience. Settings must still open without it.
    await log.error('activity', 'could not read the trail', error)
    return { items: [], nextCursor: null }
  }
}

/**
 * Erases a person's trail, for `eraseAccount`.
 *
 * This one *does* throw. Deletion is a promise the app makes in writing, and a
 * trail that outlives the account it describes breaks it — better the delete
 * fails loudly and is retried than reports success over a record still
 * sitting in another database.
 */
export async function eraseActivity(
  userId: string,
  { store = pickActivityStore() }: WithStore = {},
): Promise<void> {
  await store.deleteAllFor(userId)
}
