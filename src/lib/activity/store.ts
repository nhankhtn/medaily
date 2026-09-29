import type { ActivityPage, ActivityRecord } from './types'

/**
 * Everything the activity log needs from a database, and nothing more.
 *
 * Three methods, because three things happen to a trail: it is appended to, it
 * is read back, and it dies with the account it belongs to. Anything a
 * particular database is good at beyond that — aggregation pipelines, window
 * functions, a TTL index — stays inside its own adapter and never reaches a
 * caller.
 *
 * Nothing outside `provider.ts` names an adapter. Swapping Mongo for Postgres
 * is a second file implementing this and one line there; no service moves, and
 * no call site knows which one it got. The analytics seam next door is the
 * same shape and has already survived one such swap.
 */
export type ActivityStore = {
  /** Short name, for logs and for saying which one is in use. */
  id: string

  /**
   * Adds one entry. Must not throw: the caller is a delete that already
   * succeeded, and a log that fails a finished action is worse than no log.
   */
  append: (record: ActivityRecord) => Promise<void>

  /**
   * One page of a person's trail, newest first, scoped in the query rather
   * than filtered after.
   *
   * Keyset rather than skip/limit, like the ledger next door: a trail is
   * appended to constantly, and an offset re-reads rows that shifted under it
   * — page two arrives holding entries page one already showed.
   */
  list: (userId: string, page: { cursor?: string | null; limit: number }) => Promise<ActivityPage>

  /**
   * Erases a person's trail. Required of every adapter rather than optional,
   * because the app promises deletion takes everything — a trail that outlives
   * the account it describes turns that promise into a lie.
   */
  deleteAllFor: (userId: string) => Promise<void>
}

/**
 * Used where no database is configured, so no caller needs a null check and
 * every screen behaves as if the feature were never built.
 */
export const NO_ACTIVITY: ActivityStore = {
  id: 'none',
  append: async () => {},
  list: async () => ({ items: [], nextCursor: null }),
  deleteAllFor: async () => {},
}

/**
 * An in-memory store, for tests. It lives beside the port rather than in the
 * test folder on purpose: it is the executable statement of what an adapter
 * must do, and a new adapter can be checked against the same suite.
 */
export function inMemoryActivityStore(): ActivityStore & { all: () => ActivityRecord[] } {
  let rows: ActivityRecord[] = []

  return {
    id: 'memory',
    all: () => [...rows],
    append: async (record) => {
      rows.push(record)
    },
    list: async (userId, { cursor, limit }) => {
      const ordered = rows
        .filter((row) => row.userId === userId)
        .sort((a, b) => b.at.getTime() - a.at.getTime())
        .map((row, index) => ({
          id: `mem-${index}`,
          at: row.at.toISOString(),
          action: row.action,
          entityId: row.entityId ?? null,
          label: row.label ?? null,
          current: row.current ?? null,
          request: row.request ?? null,
        }))

      const start = cursor ? ordered.findIndex((row) => row.id === cursor) + 1 : 0
      const items = ordered.slice(start, start + limit)
      const next = ordered[start + limit]
      return { items, nextCursor: next ? (items.at(-1)?.id ?? null) : null }
    },
    deleteAllFor: async (userId) => {
      rows = rows.filter((row) => row.userId !== userId)
    },
  }
}
