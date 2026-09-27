import { firebaseAnalyticsConfigured } from '@/lib/auth/firebase-client'
import { firebaseAnalytics } from './firebase'
import { NO_ANALYTICS, type AnalyticsProvider } from './types'

/**
 * The one line that picks a provider.
 *
 * It picks Firebase, on the same project that signs people in. `vercel.tsx` is
 * left in place beside this file: it is the other working implementation of
 * the same seam, and switching back is this line rather than a rewrite.
 *
 * Nothing is mounted in development, where a counter would be recording the
 * developer, nor without the switch, nor without a measurement id — a
 * half-configured SDK reports to nowhere while still loading its scripts,
 * which is the worst of both.
 *
 * A function rather than a constant: it is read on both sides of the client
 * boundary, and a module-level value computed once at import is a value the
 * two sides can disagree about.
 */
export function pickProvider(): AnalyticsProvider {
  return analyticsEnabled() ? firebaseAnalytics : NO_ANALYTICS
}

/**
 * True when something is actually being collected — for the privacy notice,
 * which is rendered on the server.
 *
 * It answers from the environment and `firebase-client`, and deliberately not
 * by asking `pickProvider()` what it returned. Every export of a `'use client'`
 * module is a client reference, so reading `.id` off the provider object from
 * a server component throws — the same trap `mount.tsx` describes for
 * rendering `provider.Mount` across the boundary.
 */
export function analyticsEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return false
  if (!process.env.NEXT_PUBLIC_ANALYTICS_ENABLED) return false
  return firebaseAnalyticsConfigured()
}
