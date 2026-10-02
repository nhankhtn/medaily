'use client'

import { Check, Cloud } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
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

/** Days held on this device, for the chip; told whenever the queue changes. */
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((listener) => listener())

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
export async function queuePendingSave(entry: Omit<PendingSave, 'queuedAt'>): Promise<void> {
  await queuePending(pendingStore(), entry)
  changed()
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
      changed()
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

  return <OfflineChip />
}

type ChipState = { kind: 'idle' } | { kind: 'waiting'; count: number } | { kind: 'synced' }

/** A cloud while days wait on the device; a tick, briefly, once they are up. */
function OfflineChip() {
  const t = useTranslations('daily.offline')
  const [state, setState] = useState<ChipState>({ kind: 'idle' })

  useEffect(() => {
    let hide: number | undefined
    const refresh = async () => {
      let count = 0
      try {
        count = (await pendingStore().list()).length
      } catch {
        return
      }
      setState((prev) => {
        if (count > 0) return { kind: 'waiting', count }
        if (prev.kind !== 'waiting') return prev
        window.clearTimeout(hide)
        hide = window.setTimeout(() => setState({ kind: 'idle' }), 1800)
        return { kind: 'synced' }
      })
    }
    listeners.add(refresh)
    void refresh()
    return () => {
      listeners.delete(refresh)
      window.clearTimeout(hide)
    }
  }, [])

  if (state.kind === 'idle') return null

  return (
    <div
      role="status"
      className="glass-chip daily-pop fixed top-[calc(env(safe-area-inset-top,0px)+4.25rem)] left-1/2 z-30 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full px-3 text-xs font-medium"
    >
      {state.kind === 'waiting' ? (
        <>
          <span className="relative">
            <Cloud className="text-text-muted size-4" />
            <span className="bg-warn daily-live absolute -top-0.5 -right-0.5 size-1.5 rounded-full" />
          </span>
          {t('waiting', { count: state.count })}
        </>
      ) : (
        <>
          <Check className="daily-pop text-good size-4" />
          {t('upToDate')}
        </>
      )}
    </div>
  )
}
