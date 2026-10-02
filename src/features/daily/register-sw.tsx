'use client'

import { useEffect } from 'react'
import { PATHS } from '@/lib/paths'

/**
 * Registers the offline service worker, after mount so it does not fight first
 * paint.
 *
 * **Production only.** It serves `/_next/static/**` cache-first because those
 * names are content-hashed in a build — Turbopack reuses one chunk name and
 * rewrites behind it, so in dev an edit never reaches the page again.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      void retireWorker()
      return
    }

    // Registering from localhost is fine; anywhere else needs HTTPS, and the
    // browser refuses rather than warns, so there is nothing to handle here.
    navigator.serviceWorker
      .register(PATHS.serviceWorker)
      .then(primeOfflineCaches)
      .catch((error) => {
        console.error('[offline] service worker registration failed:', error)
      })
  }, [])

  return null
}

/**
 * Guarding the registration is not enough: a worker already installed keeps
 * intercepting whether or not anything registers it again.
 */
async function retireWorker(): Promise<void> {
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    if (registrations.length === 0) return

    await Promise.all(registrations.map((registration) => registration.unregister()))
    // The registration going away does not empty what it stored.
    const names = await caches.keys()
    await Promise.all(
      names.filter((name) => name.startsWith('medaily-')).map((n) => caches.delete(n)),
    )

    console.info('[offline] service worker unregistered — it only runs in a production build')
  } catch (error) {
    console.error('[offline] could not unregister the service worker:', error)
  }
}

/** On sign-out: the cache holds rendered pages of this person's own day. */
export async function clearOfflineCaches(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    registration?.active?.postMessage('clear-caches')
  } catch {
    /* signing out must not depend on the worker answering */
  }
}

function primeOfflineCaches(registration: ServiceWorkerRegistration): void {
  registration.active?.postMessage('prime-caches')
}
