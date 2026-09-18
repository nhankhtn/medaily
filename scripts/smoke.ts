import './load-env'
import { OWNER_USER_ID } from '../src/lib/auth/current-user'
import { signSession } from '../src/lib/auth/session'
import { PATHS, STATIC_PAGE_PATHS } from '../src/lib/paths'

/**
 * Signs a session with the configured secret and requests every route, in both
 * locales. Catches the class of break that typechecking cannot: a client
 * component importing server-only code, a bad query, a missing message key.
 *
 * Usage: pnpm smoke [baseUrl]
 */
const BASE = process.argv[2] ?? 'http://localhost:3000'

const ROUTES = [...STATIC_PAGE_PATHS, PATHS.api.health]

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

  /*
   * And it must not hold here. A browser refuses to register a worker whose
   * script was redirected, so the gate swallowing /sw.js turns offline support
   * off without an error anywhere — which is exactly what it did once. Checked
   * without a cookie, because that is how the browser asks for it.
   */
  const worker = await fetch(BASE + PATHS.serviceWorker, { redirect: 'manual' })
  const workerOk = worker.status === 200
  console.log(`[offline] anonymous ${PATHS.serviceWorker} -> ${worker.status} ${workerOk ? '✓' : '✗'}`)
  if (!workerOk) failures += 1

  console.log(failures === 0 ? '✓ all routes healthy' : `✗ ${failures} route failures`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('✗ smoke failed:', error)
  process.exit(1)
})
