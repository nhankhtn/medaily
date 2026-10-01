'use client'

import { Bell, BellOff, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  announcePushChange as announce,
  enablePush,
  pushAvailability,
  pushEnabledHere,
  PUSH_CHANGED,
  refreshPushToken,
  setPushEnabledHere,
  type PushAvailability,
} from '@/lib/push/client'
import { forgetPushDevice, registerPushDevice } from '@/server/actions/push'
import { IosInstallSteps } from './install-app'

/**
 * Turning notifications on for this browser.
 *
 * Per browser, not per account, which is why the card says "this device": a
 * phone and a laptop each have to be asked. The state is read after mount —
 * the server has no `Notification` to consult and would have to guess.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener(PUSH_CHANGED, onChange)
  return () => window.removeEventListener(PUSH_CHANGED, onChange)
}

export function NotificationsPanel() {
  const t = useTranslations('settings.notifications')
  // The server has no `Notification` to consult, so it answers with nothing and
  // the card appears on hydration. A primitive, so React can compare snapshots.
  const state = useSyncExternalStore<PushAvailability | null>(
    subscribe,
    pushAvailability,
    () => null,
  )
  const on = useSyncExternalStore(subscribe, pushEnabledHere, () => false)
  const [busy, setBusy] = useState(false)

  // Nothing to offer, and nothing worth explaining: an old browser or a deploy
  // with no Firebase project. A card about a feature that cannot exist here is
  // one more thing to read past.
  if (state === null || state === 'unsupported') return null

  const turnOn = async () => {
    setBusy(true)
    try {
      const token = await enablePush()
      if (!token) {
        announce()
        toast.error(t('failed'))
        return
      }
      const result = await registerPushDevice({ token, userAgent: navigator.userAgent })
      if (!result.ok) {
        toast.error(t('failed'))
        return
      }
      announce()
      toast.success(t('on'))
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    setBusy(true)
    try {
      // The browser keeps its permission — taking one back is not something a
      // page can do. What changes is this app's own record and the row on the
      // server, which together are what decide whether anything arrives.
      const token = await refreshPushToken()
      if (token) await forgetPushDevice({ token })
      setPushEnabledHere(false)
      announce()
      toast.success(t('off'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="glass rounded-[var(--radius)] p-4">
      <h2 className="text-sm font-semibold">{t('title')}</h2>
      <p className="text-text-subtle mt-0.5 mb-3 text-xs leading-snug">{t('help')}</p>

      {state === 'needs-install' ? (
        <>
          {/* The one fixable case on an iPhone, and the only honest thing to
              show: a button here could not produce a notification however many
              times it was pressed. */}
          <p className="text-text-muted mb-3 text-xs leading-snug">{t('iosNeedsInstall')}</p>
          <IosInstallSteps />
        </>
      ) : state === 'denied' ? (
        <p className="text-text-muted text-xs leading-snug">{t('blocked')}</p>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void (on ? turnOff() : turnOn())}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : on ? (
            <BellOff className="size-4" />
          ) : (
            <Bell className="size-4" />
          )}
          {on ? t('turnOff') : t('turnOn')}
        </Button>
      )}
    </section>
  )
}
