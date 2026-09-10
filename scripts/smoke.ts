import './load-env'
import { OWNER_USER_ID } from '../src/lib/auth/current-user'
import { signSession } from '../src/lib/auth/session'

/**
 * Signs a session with the configured secret and requests every route, in both
 * locales. Catches the class of break that typechecking cannot: a client
 * component importing server-only code, a bad query, a missing message key.
 *
 * Usage: pnpm smoke [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://localhost:3000'

const ROUTES = [
  '/',
  '/daily',
  '/daily/catch-up',
  '/habits',
  '/goals',
  '/projects',
  '/learning',
  '/health',
  '/finance',
  '/journal',
  '/knowledge',
  '/calendar',
  '/people',
  '/career',
  '/analytics',
  '/reviews',
  '/settings',
  '/search',
  '/api/health',
]

async function main() {
  const { AUTH_USERNAME, AUTH_SECRET } = process.env
  if (!AUTH_USERNAME || !AUTH_SECRET) throw new Error('AUTH_USERNAME and AUTH_SECRET are required')

  const token = await signSession(
    { uid: OWNER_USER_ID, sub: AUTH_USERNAME, provider: 'password' },
    AUTH_SECRET,
  )
  let failures = 0

  for (const locale of ['en', 'vi'] as const) {
    const cookie = `medaily_session=${token}; medaily_locale=${locale}`
    const results: string[] = []

    for (const route of ROUTES) {
      let status: number | string
      try {
        const response = await fetch(BASE + route, { headers: { cookie }, redirect: 'manual' })
        status = response.status
        if (response.status !== 200) failures += 1
      } catch (error) {
        status = error instanceof Error ? error.message : 'error'
        failures += 1
      }
      results.push(`${route}:${status}`)
    }

    console.log(`[${locale}] ${results.join(' ')}`)
  }

  // The gate itself must hold.
  const anonymous = await fetch(`${BASE}/daily`, { redirect: 'manual' })
  const gateOk = anonymous.status === 307 || anonymous.status === 302
  console.log(`[auth] anonymous /daily -> ${anonymous.status} ${gateOk ? '✓' : '✗'}`)
  if (!gateOk) failures += 1

  console.log(failures === 0 ? '✓ all routes healthy' : `✗ ${failures} route failures`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('✗ smoke failed:', error)
  process.exit(1)
})
