'use client'

import { getAnalytics, isSupported, logEvent, type Analytics } from 'firebase/analytics'
import { useEffect } from 'react'
import { firebaseApp } from '@/lib/auth/firebase-client'
import type { AnalyticsProvider } from './types'

/**
 * Google Analytics for Firebase, on the same Firebase project that signs
 * people in.
 *
 * **Page views are not sent from here, and must not be.** `getAnalytics` loads
 * gtag and configures the measurement id, which sends the first one; every
 * later one comes from GA4's Enhanced Measurement, whose "page changes based
 * on browser history events" watches `history.pushState` — which is what the
 * App Router navigates with. Logging them by hand as well is how one visit
 * becomes two, and the duplicate is invisible until a month of numbers is
 * already wrong. If Enhanced Measurement is ever turned off in the GA4
 * property, route changes stop being counted; turn it back on there rather
 * than adding a `logEvent` here.
 *
 * Unlike the Vercel counter this replaced, this one **does** set an
 * identifier and **does** build a profile across visits. That is a promise
 * the privacy notice had to stop making — see `lib/legal/documents.ts`.
 */

/**
 * Held so `track` can reach what `Mount` initialised. Module scope is right
 * for it: one browser tab has one Firebase app, and the alternative — a
 * context every caller has to be inside — would put a provider's shape into
 * call sites that are meant not to know which provider they have.
 */
let started: Analytics | null = null

function FirebaseAnalyticsMount() {
  useEffect(() => {
    if (started) return
    let cancelled = false

    /*
     * `isSupported` is not a formality: it answers false in a browser with no
     * cookies, in some in-app webviews, and anywhere IndexedDB is unavailable.
     * Calling `getAnalytics` regardless throws, and an unhandled throw in the
     * root layout's effect is a blank page — for a counter.
     */
    void isSupported()
      .then((supported) => {
        if (!supported || cancelled) return
        started = getAnalytics(firebaseApp())
      })
      .catch((error) => {
        console.error('[analytics] firebase could not start:', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return null
}

export const firebaseAnalytics: AnalyticsProvider = {
  id: 'firebase',

  Mount: () => <FirebaseAnalyticsMount />,

  track: ({ name, props }) => {
    /*
     * Dropped rather than queued when the mount has not finished. An event
     * worth keeping across that gap would need a buffer, a flush and a size
     * limit, and what is being counted here is an export or a sign-up — not
     * something worth that machinery to catch in the first half second.
     */
    if (!started) return
    try {
      logEvent(started, name, props)
    } catch (error) {
      // Counting something must never be the reason an action fails.
      console.error('[analytics] could not record an event:', error)
    }
  },
}
