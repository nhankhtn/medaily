import { describe, expect, it } from 'vitest'
import { inMemoryActivityStore, NO_ACTIVITY, type ActivityStore } from '@/lib/activity/store'
import type { ActivityRecord } from '@/lib/activity/types'

/**
 * The contract every `ActivityStore` owes, run against the in-memory one.
 *
 * It is written as a suite over a factory rather than against one store on
 * purpose: a Postgres adapter added later is checked by calling
 * `contract(postgresStore)` and nothing else. That is what makes the seam
 * real — an interface nobody tests is a promise, not a boundary.
 */
function contract(name: string, make: () => ActivityStore) {
  describe(`${name} keeps the ActivityStore contract`, () => {
    const entry = (userId: string, label: string, at: Date): ActivityRecord => ({
      userId,
      at,
      action: 'transaction.create',
      entityId: null,
      label,
      requestId: null,
    })

    it('returns what it was given, newest first', async () => {
      const store = make()
      await store.append(entry('me', 'older', new Date(1)))
      await store.append(entry('me', 'newer', new Date(2)))

      const page = await store.list('me', { limit: 10 })
      expect(page.items.map((row) => row.label)).toEqual(['newer', 'older'])
    })

    /** The rule that holds in Postgres holds in every other store too. */
    it('never returns somebody else’s trail', async () => {
      const store = make()
      await store.append(entry('me', 'mine', new Date(1)))
      await store.append(entry('them', 'theirs', new Date(2)))

      const page = await store.list('me', { limit: 10 })
      expect(page.items.map((row) => row.label)).toEqual(['mine'])
    })

    it('says there is no next page when the trail fits', async () => {
      const store = make()
      await store.append(entry('me', 'only', new Date(1)))

      expect((await store.list('me', { limit: 10 })).nextCursor).toBeNull()
    })

    /** Keyset paging: every row exactly once, no matter how the pages fall. */
    it('walks the whole trail without a gap or a repeat', async () => {
      const store = make()
      for (let i = 0; i < 7; i++) await store.append(entry('me', `row-${i}`, new Date(i + 1)))

      const seen: string[] = []
      let cursor: string | null | undefined
      for (let guard = 0; guard < 10; guard++) {
        const page = await store.list('me', { cursor, limit: 3 })
        seen.push(...page.items.map((row) => row.label ?? ''))
        cursor = page.nextCursor
        if (!cursor) break
      }

      expect(seen).toEqual(['row-6', 'row-5', 'row-4', 'row-3', 'row-2', 'row-1', 'row-0'])
      expect(new Set(seen).size).toBe(7)
    })

    it('starts over on a cursor it cannot place, rather than skipping rows', async () => {
      const store = make()
      await store.append(entry('me', 'only', new Date(1)))

      const page = await store.list('me', { cursor: 'not-a-cursor', limit: 10 })
      expect(page.items.map((row) => row.label)).toEqual(['only'])
    })

    /** Deletion is a promise in writing; a trail that survives it breaks it. */
    it('erases one person and leaves the other', async () => {
      const store = make()
      await store.append(entry('me', 'mine', new Date(1)))
      await store.append(entry('them', 'theirs', new Date(2)))

      await store.deleteAllFor('me')

      expect((await store.list('me', { limit: 10 })).items).toEqual([])
      expect((await store.list('them', { limit: 10 })).items).toHaveLength(1)
    })

    it('erases an account that never wrote anything without complaining', async () => {
      await expect(make().deleteAllFor('nobody')).resolves.toBeUndefined()
    })
  })
}

contract('the in-memory store', inMemoryActivityStore)

describe('the no-op store', () => {
  it('swallows an append so no caller needs a null check', async () => {
    await expect(
      NO_ACTIVITY.append({
        userId: 'me',
        at: new Date(),
        action: 'habit.update',
      }),
    ).resolves.toBeUndefined()
  })

  it('reads back an empty page rather than null', async () => {
    expect(await NO_ACTIVITY.list('me', { limit: 10 })).toEqual({ items: [], nextCursor: null })
  })
})
