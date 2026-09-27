import { SpeedInsights } from '@vercel/speed-insights/next'

/**
 * Vercel Speed Insights, which stayed when the counter moved to Firebase.
 *
 * It is not analytics and Firebase Analytics does not replace it: it reports
 * how long pages took to become usable, from real visits. The Firebase
 * equivalent is Performance Monitoring, a separate SDK and a separate script,
 * and swapping one working measurement for another buys nothing.
 *
 * Its own gate rather than `analyticsEnabled()`: that one now also asks
 * whether a Firebase measurement id exists, and load times have nothing to do
 * with whether anyone is counting visits.
 */
export function SpeedInsightsMount() {
  if (process.env.NODE_ENV !== 'production') return null
  if (!process.env.NEXT_PUBLIC_ANALYTICS_ENABLED) return null
  return <SpeedInsights />
}
