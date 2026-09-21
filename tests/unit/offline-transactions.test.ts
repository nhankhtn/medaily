import { describe, expect, it } from 'vitest'
import { drainPending, queuePending, type Sender } from '@/lib/offline/drain'
import type { QueuedTransaction } from '@/lib/offline/pending'
import { memoryStore } from '@/lib/offline/store'

/**
 * The transaction queue and the daily queue share a drain but not a key, and
 * the difference is the whole reason finance came second.
 *
 * A daily log is keyed by its date: saving a day twice means the second one
 * replaces the first, and replaying is harmless because the database upserts
 * on `(user_id, log_date)`. A transaction has no natural key — two coffees on
 * one afternoon are two rows — so the browser decides an id before the first
 * attempt, and `onConflictDoNothing` on it is what stops a retry charging the
 * coffee twice.
 */
const byId = (entry: QueuedTransaction) => entry.id

/** What the form hands the queue: everything but the timestamp it stamps on. */
const input = (id: string, amount = 30_000): Omit<QueuedTransaction, 'queuedAt'> => ({
  id,
  occurredOn: '2026-09-21',
  amount,
  kind: 'expense',
  accountId: 'account-1',
  counterAccountId: null,
  categoryId: null,
  personId: null,
  merchant: null,
  note: null,
})

const tx = (id: string, queuedAt: number, amount = 30_000): QueuedTransaction => ({
  ...input(id, amount),
  queuedAt,
})

describe('the transaction queue', () => {
  /**
   * The case the daily rule would get wrong. Under "one per day, newest wins"
   * a second coffee on the same afternoon would erase the first.
   */
  it('keeps every transaction on one day, because each is its own row', async () => {
    const store = memoryStore<QueuedTransaction>(byId)

    await queuePending(store, input('a', 30_000))
    await queuePending(store, input('b', 25_000))
    await queuePending(store, input('c', 55_000))

    const list = await store.list()
    expect(list).toHaveLength(3)
    expect(list.map((entry) => entry.amount).sort((a, b) => a - b)).toEqual([25_000, 30_000, 55_000])
  })

  /**
   * The other half of the same rule: the *same* save retried is one row, not
   * two, because the id travels with it.
   */
  it('collapses a retry of the same save onto itself', async () => {
    const store = memoryStore<QueuedTransaction>(byId)

    await store.put(tx('same', 1, 30_000))
    await store.put(tx('same', 2, 45_000))

    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0]?.amount).toBe(45_000)
  })

  it('sends oldest first and clears each by its id', async () => {
    const store = memoryStore<QueuedTransaction>(byId, [tx('a', 1), tx('b', 2), tx('c', 3)])
    const seen: string[] = []

    const send: Sender<QueuedTransaction> = async (entry) => {
      seen.push(entry.id)
      return { ok: true }
    }

    const report = await drainPending(store, send, byId)

    expect(seen).toEqual(['a', 'b', 'c'])
    expect(report).toEqual({ sent: 3, dropped: 0, kept: 0 })
    expect(await store.list()).toEqual([])
  })

  /**
   * Money must not go missing between a dead network and the next attempt.
   */
  it('keeps the transactions it could not send', async () => {
    const store = memoryStore<QueuedTransaction>(byId, [tx('a', 1), tx('b', 2), tx('c', 3)])

    const send: Sender<QueuedTransaction> = async (entry) => {
      if (entry.id === 'b') throw new Error('network')
      return { ok: true }
    }

    const report = await drainPending(store, send, byId)

    expect(report).toEqual({ sent: 1, dropped: 0, kept: 2 })
    expect((await store.list()).map(byId)).toEqual(['b', 'c'])
  })

  /**
   * A transaction pointing at an account that has since been archived will be
   * refused every time. Kept in the queue it would block every good one
   * behind it on each reconnect, forever.
   */
  it('gives up on one the server refuses outright, and carries on', async () => {
    const store = memoryStore<QueuedTransaction>(byId, [tx('a', 1), tx('b', 2), tx('c', 3)])

    const send: Sender<QueuedTransaction> = async (entry) =>
      entry.id === 'b' ? { ok: false, error: 'invalid_input' } : { ok: true }

    const report = await drainPending(store, send, byId)

    expect(report).toEqual({ sent: 2, dropped: 1, kept: 0 })
    expect(await store.list()).toEqual([])
  })
})
