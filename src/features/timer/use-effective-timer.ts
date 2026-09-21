'use client'

import { useEffect, useState } from 'react'
import type { RunningTimer } from '@/server/services/timer'
import {
  clearLocalRun,
  clearSuppressStartedAt,
  readLocalRun,
  storedFromServer,
  subscribeLocalRun,
  takeSuppressStartedAt,
  toRunningTimer,
  writeLocalRun,
  type StoredTimerRun,
} from './local-run'

/**
 * The run the UI should show: the device's mirror when it has one, otherwise
 * whatever the server rendered. Seeds the mirror from the server on first
 * sight so a mid-run disconnect still has something to pause against.
 */
export function useEffectiveTimer(serverTimer: RunningTimer | null): RunningTimer | null {
  const [local, setLocal] = useState<StoredTimerRun | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        let stored = await readLocalRun()
        const suppressed = takeSuppressStartedAt()

        if (serverTimer && suppressed === serverTimer.startedAt) {
          // Stop just cleared the mirror; the shell still has the old prop.
          stored = null
        } else {
          if (suppressed && (!serverTimer || serverTimer.startedAt !== suppressed)) {
            clearSuppressStartedAt()
          }

          if (!stored && serverTimer) {
            stored = storedFromServer(serverTimer)
            await writeLocalRun(stored)
          } else if (stored && !serverTimer && stored.serverHasRun && !stored.dirty) {
            // Server says idle and we thought we were in sync — drop the stale mirror.
            await clearLocalRun()
            stored = null
          }
        }

        if (!cancelled) {
          setLocal(stored)
          setReady(true)
        }
      } catch {
        if (!cancelled) {
          setLocal(null)
          setReady(true)
        }
      }
    }

    void refresh()
    return subscribeLocalRun(() => void refresh())
  }, [serverTimer])

  if (!ready) return serverTimer
  return local ? toRunningTimer(local) : null
}
