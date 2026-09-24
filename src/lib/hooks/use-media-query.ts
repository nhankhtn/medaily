'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether a media query matches, kept in step as the window changes.
 *
 * `useSyncExternalStore` rather than state set from an effect, for two
 * reasons: it takes a server snapshot as a first-class argument, which is
 * exactly the problem — the server must answer before a window exists — and it
 * reads through a subscription, so a resize is a re-read rather than a render
 * pass that has to remember to run.
 */
export function useMediaQuery(query: string, serverValue: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue,
  )
}
