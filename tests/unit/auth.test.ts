import { describe, expect, it } from 'vitest'
import { safeEqual, signSession, verifySession } from '@/lib/auth/session'

/**
 * The session gate is the only thing standing between a public URL and every
 * personal record in the database, so its failure modes are tested explicitly.
 */
const SECRET = 'test-secret-that-is-long-enough-32'
const UID = '00000000-0000-4000-8000-000000000001'

describe('session tokens', () => {
  it('round-trips a payload', async () => {
    const token = await signSession({ uid: UID, sub: 'me', provider: 'password' }, SECRET)
    const payload = await verifySession(token, SECRET)
    expect(payload?.sub).toBe('me')
    expect(payload?.uid).toBe(UID)
    expect(payload?.provider).toBe('password')
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  /**
   * A v1 cookie names a username, not a user row. Honouring one under
   * multi-user would mean guessing whose data it meant, so it is refused and
   * its holder signs in once more.
   */
  it('rejects a v1 cookie, even though its signature is valid', async () => {
    const legacy = { sub: 'me', iat: now(), exp: now() + 3600 }
    expect(await verifySession(await forge(legacy, SECRET), SECRET)).toBeNull()
  })

  it('rejects a validly signed payload with no uid', async () => {
    const noUid = { v: 2, sub: 'me', provider: 'password', iat: now(), exp: now() + 3600 }
    expect(await verifySession(await forge(noUid, SECRET), SECRET)).toBeNull()
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession({ uid: UID, sub: 'me', provider: 'password' }, SECRET)
    expect(await verifySession(token, 'another-secret-long-enough-3232')).toBeNull()
  })

  it('rejects a tampered payload', async () => {
    const token = await signSession({ uid: UID, sub: 'me', provider: 'password' }, SECRET)
    const [encoded, signature] = token.split('.')
    const forged = `${encoded?.slice(0, -2)}AA.${signature}`
    expect(await verifySession(forged, SECRET)).toBeNull()
  })

  it('rejects a tampered signature', async () => {
    const token = await signSession({ uid: UID, sub: 'me', provider: 'password' }, SECRET)
    expect(await verifySession(`${token.slice(0, -4)}aaaa`, SECRET)).toBeNull()
  })

  it('rejects an expired token', async () => {
    const token = await signSession({ uid: UID, sub: 'me', provider: 'password' }, SECRET, -10)
    expect(await verifySession(token, SECRET)).toBeNull()
  })

  it('rejects malformed input rather than throwing', async () => {
    expect(await verifySession(undefined, SECRET)).toBeNull()
    expect(await verifySession('', SECRET)).toBeNull()
    expect(await verifySession('no-dot', SECRET)).toBeNull()
    expect(await verifySession('a.b', SECRET)).toBeNull()
  })
})

describe('safeEqual', () => {
  it('matches identical strings', () => {
    expect(safeEqual('password', 'password')).toBe(true)
  })

  it('rejects different strings, including different lengths', () => {
    expect(safeEqual('password', 'Password')).toBe(false)
    expect(safeEqual('password', 'pass')).toBe(false)
    expect(safeEqual('', 'x')).toBe(false)
  })

  it('handles unicode', () => {
    expect(safeEqual('mật khẩu', 'mật khẩu')).toBe(true)
    expect(safeEqual('mật khẩu', 'mat khau')).toBe(false)
  })
})

const now = () => Math.floor(Date.now() / 1000)

/**
 * Signs an arbitrary payload exactly the way `signSession` does, so a test can
 * build tokens that function would refuse to mint — a valid signature over a
 * payload the verifier must still reject.
 */
async function forge(payload: object, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url')

  const encoded = b64(encoder.encode(JSON.stringify(payload)))
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(encoded))
  return `${encoded}.${b64(new Uint8Array(signature))}`
}
