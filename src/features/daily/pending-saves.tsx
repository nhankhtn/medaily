'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { drainPending, queuePending } from '@/lib/offline/drain'
import { DAILY_STORE, indexedDbStore } from '@/lib/offline/indexeddb-store'
import type { PendingSave } from '@/lib/offline/pending'
import type { PendingStore } from '@/lib/offline/store'
import { saveDay } from '@/server/actions/daily'

/**
 * One store for the app, behind the interface so the drain never learns what
 * it is writing to. Swapping IndexedDB for something else is this line.
 */
let store: PendingStore<PendingSave> | null = null

/** The daily queue is addressed by the day it holds. */
const byDate = (entry: PendingSave) => entry.date

function pendingStore(): PendingStore<PendingSave> {
  store ??= indexedDbStore<PendingSave>(DAILY_STORE)
  return store
}

/**
 * Remembers a day the network would not carry.
 *
 * Rejects when the device will not hold it — the caller has to say so rather
 * than let the toast promise something that did not happen.
 */
export function queuePendingSave(entry: Omit<PendingSave, 'queuedAt'>): Promise<void> {
  return queuePending(pendingStore(), entry)
}

/** Sign-out: an unsent day belongs to the session that wrote it, not the next one. */
export function clearPendingSaves(): Promise<void> {
  return pendingStore()
    .clear()
    .catch(() => {
      /* signing out must not depend on the store answering */
    })
}

/**
 * Drains the queue whenever the app has a chance to.
 *
 * Mounted in the shell rather than on the daily page: a day logged on the
 * metro should go up on the next screen the user opens, not only when they
 * happen to return to the form.
 */
export function PendingSaves() {
  const t = useTranslations('daily')
  const running = useRef(false)

  const drain = useCallback(async () => {
    // One drain at a time. Mount and `online` fire together often enough that
    // without this the same day is sent twice — harmless, because the write
    // upserts, but it would be reported twice.
    if (running.current) return
    running.current = true

    try {
      const { sent } = await drainPending(
        pendingStore(),
        (entry) =>
        // `null` is the action never reaching the server, which is what the
        // drain reads as "still offline, stop here".
          saveDay({
            date: entry.date,
            patch: entry.patch,
            custom: entry.custom,
            source: 'manual',
          }).catch(() => null),
        byDate,
      )

      if (sent > 0) toast.success(t('offline.synced', { count: sent }))
    } catch (error) {
      // The store itself is unreadable — private mode, a locked-down browser.
      // Nothing to tell the user here: their save already reported itself.
      console.error('[offline] could not drain the queue:', error)
    } finally {
      running.current = false
    }
  }, [t])

  useEffect(() => {
    void drain()

    const onOnline = () => void drain()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [drain])

  return null
}
