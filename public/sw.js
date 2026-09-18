/*
 * Offline support for the daily log, and nothing wider than that.
 *
 * Every page in this app is server-rendered per request, so there is no shell
 * to fall back on — what makes /daily openable offline is a copy of the last
 * page the server sent for it. That copy is a rendered page of somebody's
 * personal data, which is why it is dropped on sign-out (see `clearCaches`,
 * called from the sign-out button) and why nothing else is stored here.
 *
 * Plain JS on purpose: served straight out of `public/`, no build step, no
 * dependency, and readable by whoever has to debug it on a phone.
 */
const VERSION = 'v1'
const SHELL = `medaily-shell-${VERSION}`
const PAGES = `medaily-pages-${VERSION}`

/** Only these navigations are worth keeping. The rest are online-only. */
function isOfflinePage(url) {
  return url.pathname === '/daily' || url.pathname.startsWith('/daily/')
}

/** Hashed and immutable, so a cache hit can never be the wrong version. */
function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname === '/icon.svg'
}

self.addEventListener('install', () => {
  // Nothing is precached: the pages worth having are the ones this user has
  // actually opened, and they arrive through the fetch handler.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith('medaily-') && !name.endsWith(VERSION))
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

/** Sign-out asks for this: a cached page of personal data must not outlive it. */
self.addEventListener('message', (event) => {
  if (event.data !== 'clear-caches') return
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((n) => n.startsWith('medaily-')).map((n) => caches.delete(n)))
    })(),
  )
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit

  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

/**
 * Fresh when there is a network, the last copy when there is not. Never the
 * other way round: a daily log showing yesterday's numbers because a cache
 * was preferred would be worse than a slow page.
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)

  try {
    const response = await fetch(request)
    // Only a 200 is worth keeping. A redirect to /login is the gate doing its
    // job and must never be served from cache afterwards.
    if (response.ok && response.type !== 'opaqueredirect') {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const hit = await cache.match(request)
    if (hit) return hit
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, SHELL))
    return
  }

  // Document loads only. An RSC payload (`?_rsc=`) belongs to one build and
  // one render; serving a stale one produces a page that is subtly wrong
  // rather than honestly offline.
  if (request.mode === 'navigate' && isOfflinePage(url) && !url.searchParams.has('_rsc')) {
    event.respondWith(networkFirst(request, PAGES))
  }
})
