import { getCurrentUserId } from '@/lib/auth/current-user'
import type { ActivityAction, Snapshot } from '@/lib/activity/types'
import { log } from '@/lib/log'
import { recordActivity } from './activity'

/**
 * Handed to the action, for what the wrapper cannot see: the handler already
 * holds this person's lists and the row as it stood, so it says so rather than
 * the wrapper running the same queries again.
 *
 * A parameter, not request state: `cache()` memoises inside a render and a
 * server action is not one, so the slot written would not be the slot read.
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
 * Wraps a server action so succeeding at it is also recorded — structurally,
 * rather than by a `recordActivity()` line in every action that can be
 * forgotten or left firing on an error path.
 *
 * The user is read from the session, not an argument. Only success is
 * recorded. A failure here is swallowed, so the caller gets what it would
 * have got anyway.
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
   * A function where the verb depends on what happened — `save*` creates or
   * edits, and recording both the same way would claim a row was added every
   * time it was touched.
   */
  action: ActivityAction | ((result: Result, input: Input) => ActivityAction),
  handler: (input: Input, note: NoteChange) => Promise<Result>,
  /**
   * The id, the name and any snapshots, pulled from what came back. At the
   * wrap site because only here is the result type known. Wins over `note`.
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

    // Bookkeeping about work already done; nothing here may change the result.
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
 * A refused input answers `{ ok: false }` rather than throwing, so a returned
 * value is not proof of a change. No `ok` field means it did the work.
 */
function succeeded(result: unknown): boolean {
  if (result && typeof result === 'object' && 'ok' in result) {
    return (result as { ok: unknown }).ok !== false
  }
  return true
}
