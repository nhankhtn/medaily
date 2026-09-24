'use client'

import { Analytics } from '@vercel/analytics/react'
import { track as vercelTrack } from '@vercel/analytics'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { AnalyticsProvider } from './types'

/**
 * Vercel Web Analytics and Speed Insights.
 *
 * Both watch routing themselves once mounted, so there is no page-view call to
 * make and none should be added: doing it by hand on top of what they already
 * collect is how one visit becomes two.
 *
 * Off the Vercel platform these scripts load and report nowhere. That is why
 * `@/lib/analytics` decides whether to use this at all rather than letting the
 * components decide for themselves — a provider that quietly does nothing is
 * harder to reason about than one that was never chosen.
 */
export const vercelAnalytics: AnalyticsProvider = {
  id: 'vercel',

  Mount: () => (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  ),

  track: ({ name, props }) => {
    try {
      vercelTrack(name, props)
    } catch (error) {
      // Counting something must never be the reason an action fails.
      console.error('[analytics] could not record an event:', error)
    }
  },
}
