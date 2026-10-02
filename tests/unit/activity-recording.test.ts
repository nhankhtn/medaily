import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inMemoryActivityStore } from '@/lib/activity/store'
import { AUDITED_ENTITIES } from '@/lib/activity/registry'
import { diff } from '@/lib/activity/diff'
import { namesFrom, transactionSnapshot } from '@/server/services/activity-snapshots'

const scheduled: Promise<unknown>[] = []

vi.mock('next/server', () => ({
  after: (fn: () => unknown) => {
    scheduled.push(Promise.resolve().then(fn))
  },
}))

/** Lets the work `after` was handed finish. */
async function settle() {
  await Promise.all(scheduled.splice(0))
}

const { recordActivity } = await import('@/server/services/activity')

/**
 * `registry.ts` is only a switch if everything that writes obeys it. Two paths
 * write: the `audited()` wrapper, and the handful of places that call
 * `recordActivity` directly because there is no session to wrap — signing in
 * and signing out. The gate therefore lives in the service, and this is the
 * test that keeps it there.
 */
describe('recording an action', () => {
  beforeEach(() => {
    scheduled.length = 0
  })

  it('writes an action whose entity is followed', async () => {
    const store = inMemoryActivityStore()
    recordActivity({ userId: 'u1', action: 'transaction.delete', label: 'Cà phê' }, { store })
    await settle()

    const page = await store.list('u1', { limit: 10 })
    expect(page.items.map((row) => row.action)).toEqual(['transaction.delete'])
  })

  it('writes a sign-in, which no wrapper can record', async () => {
    const store = inMemoryActivityStore()
    recordActivity({ userId: 'u1', action: 'session.login', label: 'awish' }, { store })
    await settle()

    expect((await store.list('u1', { limit: 10 })).items).toHaveLength(1)
  })

  it('writes nothing for an entity the registry switches off', async () => {
    expect(AUDITED_ENTITIES.daily, 'the daily log is the switched-off one').toBe(false)

    const store = inMemoryActivityStore()
    recordActivity({ userId: 'u1', action: 'daily.update' }, { store })
    await settle()

    expect((await store.list('u1', { limit: 10 })).items).toEqual([])
  })

  /**
   * Any audited action would do; this one is a transaction because the
   * registry was later narrowed to money and sign-ins, and a test that
   * happens to name a switched-off entity proves nothing about scoping.
   */
  it('keeps one person out of another person page', async () => {
    const store = inMemoryActivityStore()
    recordActivity({ userId: 'u1', action: 'transaction.create', label: 'Chạy bộ' }, { store })
    recordActivity({ userId: 'u2', action: 'transaction.create', label: 'Đọc sách' }, { store })
    await settle()

    expect((await store.list('u1', { limit: 10 })).items.map((row) => row.label)).toEqual([
      'Chạy bộ',
    ])
  })

  /** A store that is down loses a line; it must never lose the request. */
  it('swallows a store that throws', async () => {
    const store = {
      ...inMemoryActivityStore(),
      append: () => Promise.reject(new Error('mongo is down')),
    }
    expect(() => recordActivity({ userId: 'u1', action: 'goal.delete' }, { store })).not.toThrow()
    await expect(settle()).resolves.not.toThrow()
  })

  /**
   * The whole chain the feature is for: an edit is written down as two
   * snapshots, and reading the trail back says what moved. The ids never
   * reach the row — a person reads "Ăn uống → Đi lại", not two UUIDs.
   */
  it('says what an edit moved, in words', async () => {
    const names = namesFrom({
      accounts: [{ id: 'acc-1', name: 'MoMo' }],
      categories: [
        { id: 'cat-1', name: 'Ăn uống' },
        { id: 'cat-2', name: 'Đi lại' },
      ],
      people: [],
    })
    const before = {
      occurredOn: '2026-09-27',
      amount: '125000',
      currency: 'VND',
      kind: 'expense',
      accountId: 'acc-1',
      categoryId: 'cat-1',
      merchant: 'Highlands',
    }
    const after = { ...before, amount: '250000', categoryId: 'cat-2' }

    const store = inMemoryActivityStore()
    recordActivity(
      {
        userId: 'u1',
        action: 'transaction.update',
        current: transactionSnapshot(before, names),
        request: transactionSnapshot(after, names),
      },
      { store },
    )
    await settle()

    const [row] = (await store.list('u1', { limit: 10 })).items
    expect(diff(row?.current ?? null, row?.request ?? null)).toEqual([
      { field: 'amount', from: '125.000 VND', to: '250.000 VND' },
      { field: 'category', from: 'Ăn uống', to: 'Đi lại' },
    ])
  })

  it('never lets a raw id reach the trail', async () => {
    const store = inMemoryActivityStore()
    recordActivity(
      {
        userId: 'u1',
        action: 'transaction.delete',
        current: transactionSnapshot(
          { amount: '90000', currency: 'VND', accountId: 'acc-1', categoryId: 'cat-1' },
          namesFrom({ accounts: [{ id: 'acc-1', name: 'MoMo' }], categories: [], people: [] }),
        ),
      },
      { store },
    )
    await settle()

    const [row] = (await store.list('u1', { limit: 10 })).items
    expect(Object.values(row?.current ?? {})).toEqual(['90.000 VND', 'MoMo'])
  })
})
