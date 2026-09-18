/**
 * The caller's address, for keying a rate limit on.
 *
 * Not the leftmost of `x-forwarded-for`. That list is one the client may send
 * its own value into, and the platform appends to rather than replaces — so the
 * leftmost entry is whatever the caller wrote, and keying on it lets anyone slip
 * a limit by changing one header per request (confirmed against the deploy:
 * twenty-five hits with a rotating `x-forwarded-for` were never once refused).
 *
 * Two things the caller cannot forge stand in for it. Vercel overwrites
 * `x-real-ip` with the real connecting address, and appends that same address
 * as the *last* entry of `x-forwarded-for` — so the entry the proxy added is the
 * one at the end, never the front. A direct hit with no proxy (local dev) has
 * neither, and one shared key is the right answer there.
 */
export function clientKey(headers: Headers): string {
  const real = headers.get('x-real-ip')?.trim()
  if (real) return real

  const forwarded = headers.get('x-forwarded-for')
  const appended = forwarded?.split(',').at(-1)?.trim()
  if (appended) return appended

  return 'local'
}
