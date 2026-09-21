'use client'

import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { drainPending, queuePending } from '@/lib/offline/drain'
import { indexedDbStore, TIMER_STOP_STORE } from '@/lib/offline/indexeddb-store'
import type { QueuedTimerStop } from '@/lib/offline/pending'
import type { PendingStore } from '@/lib/offline/store'
import { fileCompletedRun } from '@/server/actions/timer'
import { activityOf, isActivityId } from '@/lib/timer/activities'
import { syncLocalRunIfNeeded } from './run-actions'
import { clearLocalTimerState } from './local-run'

let store: PendingStore<QueuedTimerStop> | null = null

const byId = (entry: QueuedTimerStop) => entry.id

function pendingStore(): PendingStore<QueuedTimerStop> {
  store ??= indexedDbStore<QueuedTimerStop>(TIMER_STOP_STORE)
  return store
}

export async function queuePendingStop(
  entry: Omit<QueuedTimerStop, 'queuedAt'>,
): Promise<void> {
  await queuePending(pendingStore(), entry)
}

/** Sign-out: an unsent stop belongs to the session that timed it. */
export async function clearPendingStops(): Promise<void> {
  try {
    await pendingStore().clear()
  } catch {
    /* signing out must not depend on the store answering */
  }
  await clearLocalTimerState()
}

/**
 * Drains queued stops and syncs a dirty local run whenever the app is online.
 * Mounted in the shell so a stop on the metro lands without revisiting /timer.
 */
export function PendingTimerStops() {
  const t = useTranslations('timer')
  const running = useRef(false)

  const drain = useCallback(async () => {
    if (running.current) return
    running.current = true

    try {
      await syncLocalRunIfNeeded()

      const { sent } = await drainPending(
        pendingStore(),
        (entry) =>
          fileCompletedRun({
            id: entry.id,
            activity: isActivityId(entry.activity) ? entry.activity : 'learning',
            startedAt: entry.startedAt,
            endedAt: entry.endedAt,
            seconds: entry.seconds,
            workoutType: entry.workoutType,
            topicId: entry.topicId,
            projectId: entry.projectId,
            note: entry.note,
            rpe: entry.rpe,
          }).catch(() => null),
        byId,
      )

      if (sent > 0) toast.success(t('offline.synced', { count: sent }))
    } catch (error) {
      console.error('[offline] could not drain queued timer stops:', error)
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

/** Kept so a queued row's sink label can be resolved without importing actions. */
export function sinkOfQueued(entry: QueuedTimerStop) {
  return activityOf(isActivityId(entry.activity) ? entry.activity : 'learning').sink
}
