import { pickProvider } from './provider'
import type { AnalyticsEvent } from './types'

export type { AnalyticsEvent, AnalyticsProvider } from './types'
export { analyticsEnabled } from './provider'
export { AnalyticsMount } from './mount'

/**
 * Records an event, for the places worth counting deliberately — a sign-up
 * completed, an export taken. Page views are not among them: every provider
 * already watches routing, and sending them again is how a number doubles.
 */
export function track(event: AnalyticsEvent): void {
  pickProvider().track(event)
}
