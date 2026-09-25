/*
 * Offline support for home, the daily log, finance, and timer.
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
const VERSION = 'v4'
const SHELL = `medaily-shell-${VERSION}`
const PAGES = `medaily-pages-${VERSION}`

/*
 * `ignoreVary` on every lookup. Next answers /daily with
 *   Vary: rsc, next-router-state-tree, next-router-prefetch, …, Accept-Encoding
 * and the Cache API honours Vary, so without this a stored page is only
 * returned when every one of those request headers matches what was stored —
 * which is the kind of thing that works on the machine it was written on and
 * fails on a phone. The URL is the identity here; the headers are Next's
 * routing, not a different document.
 */
const LOOKUP = { ignoreVary: true }

/** The pages primed ahead of time. Everything else arrives by being visited. */
const PRIMED = ['/', '/daily', '/finance', '/timer']

/** Only these navigations are worth keeping. The rest are online-only. */
function isOfflinePage(url) {
  // / is the dashboard snapshot. /finance and /timer carry the pickers their
  // offline forms need. /daily is the full day log.
  return (
    url.pathname === '/' ||
    url.pathname === '/daily' ||
    url.pathname.startsWith('/daily/') ||
    url.pathname === '/finance' ||
    url.pathname === '/timer'
  )
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

/**
 * Fetches the pages that are worth having before they are asked for.
 *
 * Signing in does not go through a document load — the login action redirects
 * and Next follows it client-side — so a page the user reaches that way is
 * never stored by the fetch handler. Without priming, the first reload with no
 * signal after a sign-in has nothing to answer with.
 *
 * Only what is missing: the shell calls this on every mount, and re-fetching
 * four rendered pages on each cold load would be a tax paid for nothing.
 */
async function primePages() {
  const cache = await caches.open(PAGES)

  for (const path of PRIMED) {
    try {
      if (await cache.match(path, LOOKUP)) continue
      // Not `cache.add`: it follows redirects, so a signed-out prime would
      // store the sign-in page under the /daily key and serve that offline
      // forever after. `redirected` is the check that catches it.
      const response = await fetch(path)
      if (response.ok && !response.redirected) await cache.put(path, response)
    } catch {
      /* no session, or no network. The fetch handler will catch up. */
    }
  }
}

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

      // The page that installed this worker was fetched before the worker
      // existed, so nothing cached it. Without this, offline only starts
      // working on the *second* visit — which reads as broken.
      await primePages()
    })(),
  )
})

self.addEventListener('message', (event) => {
  /*
   * Sign-out asks for this: a cached page of personal data must not outlive
   * it. The shell cache is left alone on purpose — it holds content-hashed
   * build output and `/icon.svg`, nothing about anyone, and dropping it would
   * make the next person's first offline load fail for no gain.
   */
  if (event.data === 'clear-caches') {
    event.waitUntil(caches.delete(PAGES))
    return
  }

  // The app shell asks for this once it has a session, which is the first
  // moment a prime can actually come back with a page rather than a redirect
  // to the sign-in form.
  if (event.data === 'prime-caches') {
    event.waitUntil(primePages())
  }
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request, LOOKUP)
  if (hit) return hit

  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

/**
 * The page shown when there is no network and no copy of what was asked for.
 *
 * Built here rather than cached as a file: rejecting the `respondWith` instead
 * hands the browser its own failure screen — on iOS, "Safari cannot open the
 * page: FetchEvent.respondWith received an error" — which reads as the app
 * being broken rather than the phone being offline.
 *
 * 200 rather than 503: this is the answer to the navigation, and a status the
 * browser may decide to render its own interstitial for defeats the point.
 */
function offlineResponse() {
  const vi = (self.navigator.language || '').toLowerCase().startsWith('vi')
  const title = vi ? 'Chưa có kết nối' : 'No connection'
  const body = vi
    ? 'Trang này chưa được lưu về máy. Mở lại khi có mạng, rồi lần sau nó sẽ chạy được cả khi offline.'
    : 'This page has not been saved to the device yet. Open it once with a connection and it will work offline after that.'
  const retry = vi ? 'Thử lại' : 'Try again'

  return new Response(
    `<!doctype html>
<html lang="${vi ? 'vi' : 'en'}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f6f7; --fg:#18181b; --muted:#71717a; --line:#00000018 }
  @media (prefers-color-scheme: dark) { :root { --bg:#0b0b0c; --fg:#fafafa; --muted:#a1a1aa; --line:#ffffff20 } }
  body { margin:0; min-height:100dvh; display:flex; align-items:center; justify-content:center;
         padding:2rem max(1.25rem, env(safe-area-inset-left)); background:var(--bg); color:var(--fg);
         font:400 1rem/1.5 -apple-system, BlinkMacSystemFont, system-ui, sans-serif; text-align:center }
  main { max-width:22rem }
  h1 { margin:0 0 .5rem; font-size:1.125rem; font-weight:600 }
  p { margin:0 0 1.5rem; color:var(--muted); font-size:.875rem }
  button { font:inherit; font-size:.875rem; padding:.55rem 1.1rem; border-radius:999px;
           border:1px solid var(--line); background:transparent; color:var(--fg) }
</style>
<main>
  <h1>${title}</h1>
  <p>${body}</p>
  <button onclick="location.reload()">${retry}</button>
</main>
</html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } },
  )
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
    // Only a real 200 for this URL. A redirect to /login is the gate doing its
    // job, and storing where it landed would serve the sign-in page as the
    // daily log for as long as the cache lives.
    if (response.ok && !response.redirected && response.type !== 'opaqueredirect') {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const hit = await cache.match(request, LOOKUP)
    return hit ?? offlineResponse()
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
