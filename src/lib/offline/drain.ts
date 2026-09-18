import { decide, MAX_PENDING, type PendingSave, type SendResult } from './pending'
import type { PendingStore } from './store'

/** Sends one day. `null` is the call never reaching the server. */
export type Sender = (entry: PendingSave) => Promise<SendResult | null>

export type DrainReport = {
  /** Landed on the server. */
  sent: number
  /** Refused for good and given up on. */
  dropped: number
  /** Still queued when the drain stopped. */
  kept: number
}

/**
 * Sends the queue, oldest day first, and stops at the first day the network
 * would not carry.
 *
 * Takes the store and the sender rather than reaching for either, which is
 * what lets the interesting cases be tested: the third of five failing, a
 * rejection that must be given up on, a day queued in another tab while this
 * drain was in flight.
 *
 * Stopping rather than continuing past a network failure is deliberate. The
 * days behind it will fail the same way, and walking them would be one dead
 * request per day for no information.
 */
export async function drainPending(store: PendingStore, send: Sender): Promise<DrainReport> {
  const queued = await store.list()
  let sent = 0
  let dropped = 0

  for (const [index, entry] of queued.entries()) {
    const result = await send(entry).catch(() => null)
    const decision = decide(result)

    if (decision === 'stop') {
      return { sent, dropped, kept: queued.length - index }
    }

    if (decision === 'sent') sent += 1
    else dropped += 1

    // Removed by date, so a save made in another tab during the drain is left
    // alone — it was never in this snapshot and is not addressed by it.
    await store.remove(entry.date)
  }

  return { sent, dropped, kept: 0 }
}

/**
 * Remembers a day the network would not carry.
 *
 * Rejects when the device will not hold it, and the caller must say so. The
 * toast has already promised the day is safe here; a swallowed write turns
 * that into something the person only discovers by the day being gone.
 */
export async function queuePending(
  store: PendingStore,
  entry: Omit<PendingSave, 'queuedAt'>,
  max = MAX_PENDING,
): Promise<void> {
  await store.put({ ...entry, queuedAt: Date.now() })
  // A queue this long is a sync that has stopped working, not a busy week, and
  // the recent days are the ones still worth sending.
  await store.trim(max)
}
