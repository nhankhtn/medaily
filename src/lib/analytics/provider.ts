import { NO_ANALYTICS, type AnalyticsProvider } from './types'
import { vercelAnalytics } from './vercel'

/**
 * The one line that picks a provider.
 *
 * Swapping to Firebase is a second file exporting an `AnalyticsProvider` and a
 * change here — no call site moves, because nothing else imports a provider by
 * name.
 *
 * Off Vercel there is nobody listening, so nothing is mounted at all. That
 * covers development, where a counter would be recording the developer, and a
 * self-hosted build, where the scripts would load and report to nowhere.
 *
 * A function rather than a constant: it is read on both sides of the client
 * boundary, and a module-level value computed once at import is a value the
 * two sides can disagree about.
 */
export function pickProvider(): AnalyticsProvider {
  if (process.env.NODE_ENV !== 'production') return NO_ANALYTICS
  if (!process.env.NEXT_PUBLIC_ANALYTICS_ENABLED) return NO_ANALYTICS
  return vercelAnalytics
}

/** True when something is actually being collected, for the privacy notice. */
export function analyticsEnabled(): boolean {
  return pickProvider().id !== NO_ANALYTICS.id
}
