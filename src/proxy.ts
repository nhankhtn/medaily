import { NextResponse, type NextRequest } from 'next/server'
import { readAuthConfig, readGoogleConfig } from '@/lib/auth/config'
import { PATHS, PUBLIC_PATHS, safeNextPath } from '@/lib/paths'
import { REQUEST_ID_HEADER, requestIdFrom } from '@/lib/request-id'
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session'

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

  if (session) return forward()

  const url = request.nextUrl.clone()
  url.pathname = PATHS.login
  // Come back to where the user was heading once they are signed in.
  url.search = pathname === PATHS.home ? '' : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`
  const redirect = NextResponse.redirect(url)
  redirect.headers.set(REQUEST_ID_HEADER, requestId)
  return redirect
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon).*)'],
}
