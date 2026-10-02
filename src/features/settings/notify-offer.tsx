'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { toast } from 'sonner'
import {
  announcePushChange,
  enablePush,
  markPushOffered,
  pushAvailability,
  pushOfferedHere,
} from '@/lib/push/client'
import { registerPushDevice } from '@/server/actions/push'

/** Long enough for the page to settle; short enough to still be on arriving. */
const WAIT_MS = 4000

/**
 * Says once that notifications exist.
 *
 * A toast rather than a dialog. The point is that somebody who never opens
 * Settings still finds out this is here — not that they answer before they are
 * allowed to use the app. Dismissing it is a complete answer, and Settings
 * keeps the switch for as long as they want it.
 *
 * Shown only where pressing it would actually do something: never where the
 * browser has already been asked, where it is already on, where it was refused
 * (only the browser's own settings can undo that), or on an iPhone that has
 * not installed the app — that one needs the explanation the Settings card
 * carries, not a button that leads nowhere.
 */
export function NotifyOffer() {
  const t = useTranslations('onboarding.notifyOffer')
  const tc = useTranslations('settings.notifications')

  useEffect(() => {
    if (pushOfferedHere() || pushAvailability() !== 'available') return

    const timer = setTimeout(() => {
      // Something is already asking them something. Leave it alone and try on
      // a later visit rather than stacking a second thing to deal with — this
      // is also what keeps it off the back of the install offer after the tour.
      if (document.querySelector('[role="dialog"]')) return

      markPushOffered()
      toast(t('title'), {
        description: t('body'),
        duration: Infinity,
        action: {
          label: t('turnOn'),
          // Inside the click on purpose: asking for the permission anywhere
          // other than a gesture is refused outright by some browsers and
          // held against the site by others.
          onClick: () => {
            void (async () => {
              const token = await enablePush()
              if (!token) {
                announcePushChange()
                toast.error(tc('failed'))
                return
              }

              const saved = await registerPushDevice({
                token,
                userAgent: navigator.userAgent,
              })
              announcePushChange()
              if (saved.ok) toast.success(tc('on'))
              else toast.error(tc('failed'))
            })()
          },
        },
        cancel: { label: t('no'), onClick: () => {} },
      })
    }, WAIT_MS)

    return () => clearTimeout(timer)
  }, [t, tc])

  return null
}
