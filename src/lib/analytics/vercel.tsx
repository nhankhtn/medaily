'use client'

import { Analytics } from '@vercel/analytics/react'
import { track as vercelTrack } from '@vercel/analytics'
import type { AnalyticsProvider } from './types'

/**
 * Vercel Web Analytics. Not the provider in use — `provider.ts` picks Firebase
 * — and kept because it is the other working implementation of this seam, so
 * going back is one line there rather than writing this again.
 *
 * It watches routing itself once mounted, so there is no page-view call to
 * make and none should be added: doing it by hand on top of what it already
 * collects is how one visit becomes two.
 *
 * Speed Insights used to be mounted here too. It is not analytics and did not
 * move to Firebase with the counter, so it now mounts on its own from
 * `speed.tsx` — which means it stays on whichever provider is chosen, and
 * putting it back here would load it twice.
 *
 * Off the Vercel platform this script loads and reports nowhere. That is why
 * `@/lib/analytics` decides whether to use this at all rather than letting the
 * component decide for itself — a provider that quietly does nothing is harder
 * to reason about than one that was never chosen.
 */
export const vercelAnalytics: AnalyticsProvider = {
  id: 'vercel',

  Mount: () => <Analytics />,

  track: ({ name, props }) => {
    try {
      vercelTrack(name, props)
    } catch (error) {
      // Counting something must never be the reason an action fails.
      console.error('[analytics] could not record an event:', error)
    }
  },
}
