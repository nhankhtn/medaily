import { getCurrentUserId } from '@/lib/auth/current-user'
import type { ActivityAction, Snapshot } from '@/lib/activity/types'
import { log } from '@/lib/log'
import { recordActivity } from './activity'

/**
 * What an action tells the trail about itself. Every field is optional: an
 * action that says nothing still gets a dated line saying it happened.
 */
/**
 * Handed to the action itself, for what the wrapper cannot see from outside.
 *
 * Turning `categoryId` into "Ăn uống" needs this person's categories, and the
 * row as it stood needs reading before the update writes over it. The handler
 * has both already — it loaded the lists to check ownership and it is about to
 * overwrite the old row — so it says so, rather than the wrapper running the
 * same three queries a second time.
 *
 * It is a parameter rather than anything request-scoped on purpose. `cache()`
 * from React only memoises inside a render, and a server action is not one:
 * there, each call builds a fresh value, so a slot written by the handler is
 * not the slot the wrapper reads, and every row lands with two nulls in it.
 */
export type NoteChange = (snapshots: {
  current?: Snapshot | null
  request?: Snapshot | null
}) => void

export type AuditDetails = {
  /** Which row it was about, so a trail can be followed back to a record. */
  entityId?: string | null
  /** What a person would call it — "Ăn tối", "Highlands". */
  label?: string | null
  /** The row as it stood before. A create has none; nothing stood there. */
  current?: Snapshot | null
  /** What the action was asked to make it. A delete has none. */
  request?: Snapshot | null
}

/**
 * Wraps a server action so that succeeding at it is also recorded.
 *
 * It exists because the alternative — a `recordActivity()` call inside every
 * action — is a line that can be forgotten, written with the wrong user, or
 * left firing on a path that returned an error. Here those are structural:
 *
 * - **The user is never wrong.** The wrapper reads the session itself rather
 *   than trusting an argument. `getCurrentUserId` is `cache()`d per request,
 *   so asking again costs nothing.
 * - **Only success is recorded.** An action returning `{ ok: false }` changed
 *   nothing, and a trail full of attempts is a trail nobody reads.
 * - **Recording never breaks the action.** A failure here is logged and
 *   swallowed; the caller gets the result it would have got anyway.
 * - **What is followed is configuration.** `registry.ts` decides which objects
 *   have a trail at all; `recordActivity` enforces it, so the hand-written
 *   callers obey the same switch.
 *
 * ```ts
 * export const removeTransaction = audited(
 *   'transaction.delete',
 *   async (input: unknown) => { … },
 *   ({ result }) => ({ entityId: result.removed?.id, label: result.removed?.merchant }),
 * )
 * ```
 */
export function audited<Input, Result>(
  /**
   * A function where the action depends on what happened. Half the mutations
   * here are `save*`: one call that creates when it is handed no id and edits
   * when it is, and recording both as the same thing would make the trail
   * claim a row was added every time it was touched.
   */
  action: ActivityAction | ((result: Result, input: Input) => ActivityAction),
  handler: (input: Input, note: NoteChange) => Promise<Result>,
  /**
   * Pulls the id, the name and — where they follow from what came back — the
   * two snapshots out of what happened. Declared at the wrap site rather than
   * in the registry because only here is the result type known; a central
   * table of these would be a table of `any`.
   *
   * An action that needs its own lists or the row as it stood says so from
   * inside itself, through the `note` it is handed. Anything named in both
   * places, this one wins.
   */
  details?: (context: { result: Result; input: Input }) => AuditDetails,
): (input: Input) => Promise<Result> {
  return async (input: Input) => {
    // One per call, so two actions in one request cannot read each other's.
    const said: { current: Snapshot | null; request: Snapshot | null } = {
      current: null,
      request: null,
    }
    const note: NoteChange = (snapshots) => {
      if (snapshots.current !== undefined) said.current = snapshots.current
      if (snapshots.request !== undefined) said.request = snapshots.request
    }

    const result = await handler(input, note)

    // Everything below is bookkeeping about an action that has already done its
    // work, so nothing in it may change what the caller receives.
    try {
      if (succeeded(result)) {
        const resolved = typeof action === 'function' ? action(result, input) : action
        const described = details?.({ result, input }) ?? {}

        recordActivity({
          userId: await getCurrentUserId(),
          action: resolved,
          entityId: described.entityId ?? null,
          label: described.label ?? null,
          current: described.current ?? said.current,
          request: described.request ?? said.request,
        })
      }
    } catch (error) {
      await log.error('activity', 'could not record an action', error)
    }

    return result
  }
}

/**
 * Actions here answer `{ ok: false, error }` on a refused input rather than
 * throwing, so a returned value is not by itself proof that anything changed.
 * Anything without an `ok` field did its work or threw, and a throw never
 * reaches this line.
 */
function succeeded(result: unknown): boolean {
  if (result && typeof result === 'object' && 'ok' in result) {
    return (result as { ok: unknown }).ok !== false
  }
  return true
}
