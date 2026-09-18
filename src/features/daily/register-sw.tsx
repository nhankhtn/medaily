'use client'

import { useEffect } from 'react'
import { PATHS } from '@/lib/paths'

/**
 * Registers the service worker that makes `/daily` openable with no network.
 *
 * Registered from the client after mount rather than in the document: it is
 * not needed to render anything, and a worker fighting for the main thread
 * during first paint is a worse trade than a page that works offline on the
 * second visit.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    // Registering from localhost is fine; anywhere else needs HTTPS, and the
    // browser refuses rather than warns, so there is nothing to handle here.
    navigator.serviceWorker.register(PATHS.serviceWorker).catch((error) => {
      console.error('[offline] service worker registration failed:', error)
    })
  }, [])

  return null
}

/**
 * Drops the cached pages. Called on sign-out: what the worker kept is a
 * rendered page of this person's own day, and it must not be sitting there
 * for whoever signs in next.
 */
export async function clearOfflineCaches(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    registration?.active?.postMessage('clear-caches')
  } catch {
    /* signing out must not depend on the worker answering */
  }
}
