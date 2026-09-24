import type { ReactNode } from 'react'

/**
 * What the app needs from whoever is counting, and nothing more.
 *
 * The two providers worth planning for are shaped very differently — Vercel
 * mounts a component that watches routing on its own, Firebase initialises an
 * SDK and is told about each event — so the seam is drawn where they agree:
 * something to mount once, and a way to name an event. Everything either one
 * does beyond that stays inside its own file.
 *
 * The rest of the app never imports a provider. It imports `@/lib/analytics`,
 * which picks one; swapping means writing a second file and changing the line
 * that chooses, not hunting for call sites.
 */
export type AnalyticsEvent = {
  name: string
  /** Kept to primitives: every provider accepts these and none accepts more. */
  props?: Record<string, string | number | boolean>
}

export type AnalyticsProvider = {
  /** Short name, for logs and for the privacy notice to be able to name it. */
  id: string

  /**
   * Mounted once, in the root layout. Returns nothing when the provider has
   * nothing to put in the document — which is the normal case for an SDK that
   * initialises itself, and the reason this is a node rather than a script.
   */
  Mount: () => ReactNode

  /**
   * Records something the provider could not have seen by watching the URL.
   * Page views are not sent through here: every provider already does those,
   * and sending them twice is how a number quietly doubles.
   */
  track: (event: AnalyticsEvent) => void
}

/** Used where analytics is switched off, so no call site needs a null check. */
export const NO_ANALYTICS: AnalyticsProvider = {
  id: 'none',
  Mount: () => null,
  track: () => {},
}
