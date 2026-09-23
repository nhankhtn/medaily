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
 *
 * **Production only.** The worker serves `/_next/static/**` cache-first on the
 * grounds that those filenames are content-hashed, which is true of a build
 * and not of `next dev`: Turbopack reuses one chunk name and rewrites what is
 * behind it. In development that turns an edit into a stylesheet the worker
 * keeps answering from cache — through a reload, through a hard reload, and
 * through a restart of the dev server, because the worker replies before the
 * network is ever asked.
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
    navigator.serviceWorker.register(PATHS.serviceWorker).catch((error) => {
      console.error('[offline] service worker registration failed:', error)
    })
  }, [])

  return null
}

/**
 * Undoes a worker registered by an earlier build of this app.
 *
 * Guarding the registration is not enough on its own: a worker already
 * installed in this browser keeps intercepting every request whether or not
 * anything registers it again. Whoever is running the dev server has one, and
 * it is the reason their stylesheet is a week old.
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
