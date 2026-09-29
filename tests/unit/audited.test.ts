import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inMemoryActivityStore } from '@/lib/activity/store'

const scheduled: Promise<unknown>[] = []

vi.mock('next/server', () => ({
  after: (fn: () => unknown) => {
    scheduled.push(Promise.resolve().then(fn))
  },
}))

vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUserId: async () => 'u1',
}))

const store = inMemoryActivityStore()
vi.mock('@/lib/activity/provider', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  pickActivityStore: () => store,
}))

const { audited } = await import('@/server/services/audited')
const { findActivity } = await import('@/server/services/activity')

async function settle() {
  await Promise.all(scheduled.splice(0))
}

/** The real read path, so `changes` is worked out the way Settings sees it. */
async function trail() {
  return (await findActivity('u1')).items
}

/**
 * These go through the wrapper rather than calling `recordActivity` directly,
 * which is the whole point of them. The first version of the snapshot plumbing
 * used a `cache()` slot to get the two snapshots from the action to the
 * wrapper; that memoises only inside a render, so in a server action the
 * handler wrote to one object and the wrapper read another, and every row
 * landed with `current: null, request: null`. The unit tests passed anyway —
 * they handed `recordActivity` its snapshots and never exercised the part that
 * was broken.
 */
describe('the audited wrapper', () => {
  beforeEach(async () => {
    scheduled.length = 0
    await store.deleteAllFor('u1')
  })

  it('carries the snapshots the action noted all the way to the store', async () => {
    const save = audited(
      'transaction.update',
      async (_input: unknown, audit) => {
        audit({ current: { amount: '125.000 VND' }, request: { amount: '250.000 VND' } })
        return { ok: true as const }
      },
      () => ({ entityId: 'tx-1' }),
    )

    await save({})
    await settle()

    const [row] = await trail()
    expect(row?.current).toEqual({ amount: '125.000 VND' })
    expect(row?.request).toEqual({ amount: '250.000 VND' })
    expect(row?.changes).toEqual([{ field: 'amount', from: '125.000 VND', to: '250.000 VND' }])
  })

  it('records a create with a request and no current', async () => {
    const create = audited('transaction.create', async (_input: unknown, audit) => {
      audit({ request: { merchant: 'Highlands' } })
      return { ok: true as const }
    })

    await create({})
    await settle()

    const [row] = await trail()
    expect(row?.current).toBeNull()
    expect(row?.request).toEqual({ merchant: 'Highlands' })
  })

  it('records nothing at all when the action refused the input', async () => {
    const save = audited('transaction.update', async (_input: unknown, audit) => {
      audit({ request: { merchant: 'Highlands' } })
      return { ok: false as const, error: 'invalid_input' as const }
    })

    await save({})
    await settle()

    expect(await trail()).toEqual([])
  })

  /** Two actions in one request must not read each other's notes. */
  it('keeps one call snapshots out of the next call', async () => {
    const noisy = audited('transaction.update', async (_input: unknown, audit) => {
      audit({ request: { merchant: 'Highlands' } })
      return { ok: true as const }
    })
    const quiet = audited('transaction.delete', async () => ({ ok: true as const }))

    await noisy({})
    await quiet({})
    await settle()

    const rows = await trail()
    const deletion = rows.find((row) => row.action === 'transaction.delete')
    expect(deletion?.request).toBeNull()
    expect(deletion?.current).toBeNull()
  })

  it('hands the caller its result even when recording throws', async () => {
    const angry = audited(
      'transaction.update',
      async () => ({ ok: true as const, value: 42 }),
      () => {
        throw new Error('describe is broken')
      },
    )

    await expect(angry({})).resolves.toEqual({ ok: true, value: 42 })
  })
})
