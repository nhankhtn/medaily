import { NextResponse, type NextRequest } from 'next/server'
import { readAuthConfig, readGoogleConfig } from '@/lib/auth/config'
import { PATHS, PUBLIC_PATHS, safeNextPath } from '@/lib/paths'
import { REQUEST_ID_HEADER, requestIdFrom } from '@/lib/request-id'
import {
  renewalTtl,
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionStartedAt,
  signSession,
  verifySession,
} from '@/lib/auth/session'

/**
 * Spec 29 — every personal-data route requires a session. The check runs here,
 * ahead of routing, so no page, action or route handler can forget it.
 *
 * Next.js 16 renamed this file and its export from `middleware` to `proxy`.
 *
 * When credentials are not configured the app is closed, not open: an
 * unconfigured deploy shows the sign-in page and rejects the credentials,
 * rather than serving someone else's data to the internet.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Stamped before anything else can fail, so even a rejected request has an
  // id to quote. It goes onto the request for the app and onto the response
  // for whoever is looking at devtools.
  const requestId = requestIdFrom(request.headers)
  const forward = () => {
    const headers = new Headers(request.headers)
    headers.set(REQUEST_ID_HEADER, requestId)
    const response = NextResponse.next({ request: { headers } })
    response.headers.set(REQUEST_ID_HEADER, requestId)
    return response
  }

  // The notes live on the learning page now. This is here rather than in a
  // page of its own because `redirect()` while rendering only reaches the
  // client as a meta tag; a link from before the move deserves a real 307.
  if (pathname === PATHS.knowledge) {
    const note = request.nextUrl.searchParams.get('note')
    const moved = NextResponse.redirect(
      new URL(note ? PATHS.note(note) : PATHS.learningTab('notes'), request.url),
    )
    moved.headers.set(REQUEST_ID_HEADER, requestId)
    return moved
  }

  const signingIn = pathname === PATHS.login
  if (
    !signingIn &&
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  ) {
    return forward()
  }

  const auth = readAuthConfig()
  const google = readGoogleConfig()
  const usable = auth.secret.length >= 16 && (auth.configured || google.configured)

  const session = usable
    ? await verifySession(request.cookies.get(SESSION_COOKIE)?.value, auth.secret)
    : null

  // The sign-in page has nothing to offer someone who is already signed in.
  if (signingIn) {
    if (!session) return forward()
    const onwards = NextResponse.redirect(
      new URL(safeNextPath(request.nextUrl.searchParams.get('next')), request.url),
    )
    onwards.headers.set(REQUEST_ID_HEADER, requestId)
    return onwards
  }

  if (session) {
    const response = forward()

    /*
     * Renewed while it is being used, so somebody who opens the app most weeks
     * is never signed out — but only on GET.
     *
     * Signing out is a server action, which is a POST: renewing there would
     * put a fresh `Set-Cookie` on the same response the action clears the
     * cookie on, and which of the two wins is a question about header order
     * that signing out should not depend on. Opening a page and navigating are
     * both GETs, so nothing is lost by staying out of the way of every write.
     *
     * Two tabs crossing the halfway mark at once both renew, and that is
     * harmless: each writes a valid cookie and the last one lands. This is the
     * whole reason it is a sliding cookie rather than a rotating refresh
     * token, where the second of those two would present a token the first had
     * just retired and be thrown out mid-session.
     */
    if (request.method === 'GET') {
      const ttl = renewalTtl(session, Math.floor(Date.now() / 1000))
      if (ttl !== null) {
        const token = await signSession(
          {
            uid: session.uid,
            sub: session.sub,
            provider: session.provider,
            sat: sessionStartedAt(session),
          },
          auth.secret,
          ttl,
        )
        response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(ttl))
      }
    }

    return response
  }

  const url = request.nextUrl.clone()

  // Someone typing the bare address has not been turned away from anything —
  // they may never have heard of this app. They get the page that says what it
  // is; a deep link still goes to sign-in, and comes back afterwards.
  if (pathname === PATHS.home) {
    url.pathname = PATHS.welcome
    url.search = ''
  } else {
    url.pathname = PATHS.login
    // Come back to where the user was heading once they are signed in.
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`
  }
  const redirect = NextResponse.redirect(url)
  redirect.headers.set(REQUEST_ID_HEADER, requestId)
  return redirect
}

export const config = {
  // Static files under `public/` reach the proxy like any other path, so the
  // ones that are nobody's personal data are named here — otherwise every
  // brand mark costs a session check and can never be cached at the edge.
  //
  // `opengraph-image` is in that list for a second reason: the scraper that
  // fetches it to build a link preview has no session and never will, so
  // behind the gate it gets a redirect and the card comes out blank.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-maskable|apple-icon|opengraph-image|brands/).*)',
  ],
}
