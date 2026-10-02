'use client'

import { useEffect } from 'react'
import { tokenToRefresh } from '@/lib/push/client'
import { registerPushDevice } from '@/server/actions/push'

/**
 * Re-registers this browser's push token on every load of the shell.
 *
 * FCM rotates tokens on its own, and there are reports of it doing so on iOS
 * after a handful of notifications. A token stored once at the moment somebody
 * pressed the button is a device that quietly stops being reachable — with
 * nothing to see, because nothing failed.
 *
 * Does nothing where permission was never granted, so this is one `Notification
 * .permission` read for everybody else. Silent either way: there is no action
 * a visitor could take about it, and a toast would be about the app's own
 * bookkeeping.
 */
export function PushRefresh() {
  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const token = await tokenToRefresh()
        if (!token || cancelled) return
        await registerPushDevice({ token, userAgent: navigator.userAgent })
      } catch {
        /* Offline, or the browser changed its mind. The next load asks again. */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
