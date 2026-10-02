import type { ActivityPage, ActivityRecord } from './types'

/**
 * Everything the activity log needs from a database: appended to, read back,
 * and dead with its account. Anything an adapter is good at beyond that stays
 * inside it. Only `provider.ts` names one.
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
   * Newest first, scoped in the query. Keyset, not offset: a trail is appended
   * to constantly, and page two would repeat what page one showed.
   */
  list: (userId: string, page: { cursor?: string | null; limit: number }) => Promise<ActivityPage>

  /** Required, not optional: a trail outliving its account breaks the promise. */
  deleteAllFor: (userId: string) => Promise<void>
}

/** No database configured: every screen behaves as if it were never built. */
export const NO_ACTIVITY: ActivityStore = {
  id: 'none',
  append: async () => {},
  list: async () => ({ items: [], nextCursor: null }),
  deleteAllFor: async () => {},
}

/** For tests, beside the port: the executable statement of what an adapter does. */
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
