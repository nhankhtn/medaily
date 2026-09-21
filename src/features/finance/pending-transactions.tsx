'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { drainPending, queuePending } from '@/lib/offline/drain'
import { indexedDbStore, TRANSACTION_STORE } from '@/lib/offline/indexeddb-store'
import type { QueuedTransaction } from '@/lib/offline/pending'
import type { PendingStore } from '@/lib/offline/store'
import { createTransaction } from '@/server/actions/finance'

let store: PendingStore<QueuedTransaction> | null = null

/** Addressed by the id the browser chose, which is also what makes a replay safe. */
const byId = (entry: QueuedTransaction) => entry.id

function pendingStore(): PendingStore<QueuedTransaction> {
  store ??= indexedDbStore<QueuedTransaction>(TRANSACTION_STORE)
  return store
}

/**
 * The queue changed. Rows waiting to be sent are drawn from the store rather
 * than from React state, so every view of them has to be told when to look
 * again — and two tabs of the same app each have their own store handle.
 */
const CHANGED = 'medaily:pending-transactions'

function announce(): void {
  window.dispatchEvent(new Event(CHANGED))
}

export async function queuePendingTransaction(
  entry: Omit<QueuedTransaction, 'queuedAt'>,
): Promise<void> {
  await queuePending(pendingStore(), entry)
  announce()
}

/** Sign-out: an unsent transaction belongs to the session that wrote it. */
export async function clearPendingTransactions(): Promise<void> {
  try {
    await pendingStore().clear()
    announce()
  } catch {
    /* signing out must not depend on the store answering */
  }
}

/**
 * The transactions still waiting for a network.
 *
 * They have to be read from the store, not held in React state. The form's
 * optimistic row is `useOptimistic`, which resets the moment the action
 * settles — so a transaction that was queued rather than sent would vanish
 * off the screen while the server has no record of it either. Money
 * disappearing is the one thing this feature must not do.
 */
export function useQueuedTransactions(): QueuedTransaction[] {
  const [queued, setQueued] = useState<QueuedTransaction[]>([])

  useEffect(() => {
    let live = true

    const read = () => {
      pendingStore()
        .list()
        .then((rows) => {
          if (live) setQueued(rows)
        })
        .catch(() => {
          // A store that cannot be read shows nothing rather than breaking the
          // page; the ledger below it is still the truth.
          if (live) setQueued([])
        })
    }

    read()
    window.addEventListener(CHANGED, read)
    return () => {
      live = false
      window.removeEventListener(CHANGED, read)
    }
  }, [])

  return queued
}

/**
 * Sends what is queued whenever the app has a chance to.
 *
 * In the shell rather than on the finance page: a transaction typed at a food
 * stall should go up on the next screen opened, not only on a return to the
 * ledger.
 */
export function PendingTransactions() {
  const t = useTranslations('finance')
  const router = useRouter()
  const running = useRef(false)

  const drain = useCallback(async () => {
    if (running.current) return
    running.current = true

    try {
      const { sent } = await drainPending(
        pendingStore(),
        (entry) =>
          createTransaction({
            id: entry.id,
            occurredOn: entry.occurredOn,
            amount: entry.amount,
            kind: entry.kind,
            accountId: entry.accountId,
            counterAccountId: entry.counterAccountId,
            categoryId: entry.categoryId,
            personId: entry.personId,
            merchant: entry.merchant,
            note: entry.note,
            // `null` is the action never reaching the server, which the drain
            // reads as "still offline, stop here".
          }).catch(() => null),
        byId,
      )

      if (sent > 0) {
        announce()
        toast.success(t('offline.synced', { count: sent }))
        // The rows are on the server now; the ledger has to be re-read or the
        // page keeps showing the moment before they landed.
        router.refresh()
      }
    } catch (error) {
      console.error('[offline] could not drain queued transactions:', error)
    } finally {
      running.current = false
    }
  }, [t, router])

  useEffect(() => {
    void drain()

    const onOnline = () => void drain()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [drain])

  return null
}
