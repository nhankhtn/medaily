import { describe, expect, it } from 'vitest'
import { drainPending, queuePending, type Sender } from '@/lib/offline/drain'
import { MAX_PENDING, type PendingSave } from '@/lib/offline/pending'
import { memoryStore } from '@/lib/offline/store'

/**
 * The drain is where a day someone logged with no signal is either delivered
 * or lost. Injecting the store and the sender is what makes that testable —
 * these assertions are about the loop, not about a browser.
 */
const save = (date: string, queuedAt: number): PendingSave => ({
  date,
  patch: { energy: 5 },
  custom: {},
  queuedAt,
})

/** A sender scripted per date, so a failure can be put in the middle. */
function sender(script: Record<string, SendOutcome>): Sender & { calls: string[] } {
  const calls: string[] = []
  const fn = (async (entry: PendingSave) => {
    calls.push(entry.date)
    const outcome = script[entry.date] ?? { ok: true as const }
    if (outcome === 'throw') throw new Error('network')
    return outcome
  }) as Sender & { calls: string[] }
  fn.calls = calls
  return fn
}

type SendOutcome = { ok: true } | { ok: false; error: string } | 'throw'

describe('drainPending', () => {
  it('sends every queued day, oldest first, and empties the queue', async () => {
    const store = memoryStore([save('2026-09-16', 1), save('2026-09-17', 2), save('2026-09-18', 3)])
    const send = sender({})

    const report = await drainPending(store, send)

    expect(send.calls).toEqual(['2026-09-16', '2026-09-17', '2026-09-18'])
    expect(report).toEqual({ sent: 3, dropped: 0, kept: 0 })
    expect(await store.list()).toEqual([])
  })

  /**
   * The case the whole design is for: the network dies partway. Everything
   * from the failure onwards has to still be there, or an evening is gone.
   */
  it('stops at a network failure and keeps that day and the ones behind it', async () => {
    const store = memoryStore([save('2026-09-16', 1), save('2026-09-17', 2), save('2026-09-18', 3)])
    const send = sender({ '2026-09-17': 'throw' })

    const report = await drainPending(store, send)

    // It does not walk the rest: they would fail the same way.
    expect(send.calls).toEqual(['2026-09-16', '2026-09-17'])
    expect(report).toEqual({ sent: 1, dropped: 0, kept: 2 })
    expect((await store.list()).map((entry) => entry.date)).toEqual(['2026-09-17', '2026-09-18'])
  })

  /**
   * A day the server will never take must not sit at the head of the queue
   * blocking the good ones behind it on every reconnect, forever.
   */
  it('gives up on a day that is refused for good and carries on', async () => {
    const store = memoryStore([save('2026-09-16', 1), save('2026-09-17', 2), save('2026-09-18', 3)])
    const send = sender({ '2026-09-17': { ok: false, error: 'invalid_input' } })

    const report = await drainPending(store, send)

    expect(send.calls).toHaveLength(3)
    expect(report).toEqual({ sent: 2, dropped: 1, kept: 0 })
    expect(await store.list()).toEqual([])
  })

  it('keeps a day on a rejection it does not recognise', async () => {
    const store = memoryStore([save('2026-09-18', 1)])
    const send = sender({ '2026-09-18': { ok: false, error: 'rate_limited' } })

    const report = await drainPending(store, send)

    expect(report).toEqual({ sent: 0, dropped: 0, kept: 1 })
    expect(await store.list()).toHaveLength(1)
  })

  /**
   * Removing by date rather than by position is what makes this safe: the new
   * day was never in the snapshot being drained, so it survives it.
   */
  it('leaves a day queued in another tab mid-drain alone', async () => {
    const store = memoryStore([save('2026-09-16', 1)])
    const send: Sender = async () => {
      await queuePending(store, { date: '2026-09-18', patch: { energy: 9 }, custom: {} })
      return { ok: true }
    }

    const report = await drainPending(store, send)

    expect(report.sent).toBe(1)
    expect((await store.list()).map((entry) => entry.date)).toEqual(['2026-09-18'])
  })

  it('does nothing, and says so, on an empty queue', async () => {
    const send = sender({})
    expect(await drainPending(memoryStore(), send)).toEqual({ sent: 0, dropped: 0, kept: 0 })
    expect(send.calls).toEqual([])
  })
})

describe('queuePending', () => {
  it('keeps the newest save of a day, not both', async () => {
    const store = memoryStore()
    await queuePending(store, { date: '2026-09-18', patch: { energy: 1 }, custom: {} })
    await queuePending(store, { date: '2026-09-18', patch: { energy: 8 }, custom: {} })

    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0]?.patch).toEqual({ energy: 8 })
  })

  it('trims the oldest once the queue is past its cap', async () => {
    const store = memoryStore()
    for (let i = 0; i < MAX_PENDING + 3; i++) {
      await queuePending(store, { date: `day-${i}`, patch: { energy: 5 }, custom: {} })
    }

    const list = await store.list()
    expect(list).toHaveLength(MAX_PENDING)
    expect(list[0]?.date).toBe('day-3')
  })

  /**
   * The toast has just told someone the day is safe on this device. A store
   * that cannot hold it has to reach the caller, not be swallowed here.
   */
  it('rejects when the device will not hold the day', async () => {
    const store = memoryStore()
    store.failNextPut('quota exceeded')

    await expect(
      queuePending(store, { date: '2026-09-18', patch: { energy: 5 }, custom: {} }),
    ).rejects.toThrow(/quota/)

    expect(await store.list()).toEqual([])
  })
})
