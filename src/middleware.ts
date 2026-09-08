import { NextResponse, type NextRequest } from 'next/server'
import { LOGIN_PATH, PUBLIC_PATHS, readAuthConfig } from '@/lib/auth/config'
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session'

/**
 * Spec 29 — every personal-data route requires a session. The check runs in
 * middleware so no page, action or route handler can forget it.
 *
 * When credentials are not configured the app is closed, not open: an
 * unconfigured deploy shows the sign-in page and rejects the credentials,
 * rather than serving someone else's data to the internet.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next()
  }

  const auth = readAuthConfig()
  const session = auth.configured
    ? await verifySession(request.cookies.get(SESSION_COOKIE)?.value, auth.secret)
    : null

  if (session) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = LOGIN_PATH
  // Come back to where the user was heading once they are signed in.
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png).*)'],
}
